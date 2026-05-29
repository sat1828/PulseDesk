import db from '../db/connection';
import { encrypt, computeMemberHash } from '../crypto/index';
import { logger } from './logger';
import { ScoreResult } from '../types';

const WEIGHTS = {
  sentiment: 0.35,
  afterHours: 0.30,
  latency: 0.22,
  vocabShift: 0.13,
};

const MIN_MEMBERS = 5;
const BASELINE_WEEKS = 4;

function circularHourStdDev(hours: number[]): number {
  if (hours.length < 2) return 0;
  const radians = hours.map(h => (h / 24) * 2 * Math.PI);
  const meanSin = radians.reduce((s, r) => s + Math.sin(r), 0) / radians.length;
  const meanCos = radians.reduce((s, r) => s + Math.cos(r), 0) / radians.length;
  const meanAngle = Math.atan2(meanSin, meanCos);
  const distances = radians.map(r => {
    let d = r - meanAngle;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    return d;
  });
  const variance = distances.reduce((s, d) => s + d * d, 0) / distances.length;
  const stdDevRad = Math.sqrt(variance);
  return (stdDevRad / (2 * Math.PI)) * 24;
}

async function callNlpService(endpoint: 'vocab-shift' | 'sentiment', body: object): Promise<any> {
  const nlpUrl = process.env.NLP_SERVICE_URL || 'http://localhost:5001';
  const apiKey = process.env.NLP_SERVICE_API_KEY || 'internal_service_key';

  try {
    const res = await fetch(`${nlpUrl}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`NLP service error: ${res.status}`);
    return await res.json();
  } catch (err) {
    logger.warn({ err }, 'NLP service unavailable, falling back to SQL approximation');
    return null;
  }
}

function fallbackSentimentScore(curSentMsg: any[]): number {
  if (curSentMsg.length === 0) return 50;
  const avgSent = curSentMsg.reduce((sum: number, m: any) => sum + (m.sentiment_score || 0), 0) / curSentMsg.length;
  return Math.min(100, Math.max(0, Math.round(50 - avgSent * 50)));
}

function fallbackVocabScore(curSentMsg: any[], baseSentMsg: any[]): number {
  const curCount = curSentMsg.length;
  const baseCount = baseSentMsg.length;
  if (curCount === 0 || baseCount === 0) return 50;

  const curAvgLen = curSentMsg.reduce((s: number, m: any) => s + (m.message_length || 0), 0) / curCount;
  const baseAvgLen = baseSentMsg.reduce((s: number, m: any) => s + (m.message_length || 0), 0) / baseCount;

  const curQRate = curSentMsg.filter((m: any) => m.has_question).length / curCount;
  const baseQRate = baseSentMsg.filter((m: any) => m.has_question).length / baseCount;

  const lenRatio = baseAvgLen > 0 ? curAvgLen / baseAvgLen : 1;
  const qRatio = baseQRate > 0 ? curQRate / baseQRate : 1;

  const vocabScore = Math.round(
    (1 - Math.min(lenRatio, 1)) * 50 +
    (1 - Math.min(qRatio, 1)) * 30 +
    (curSentMsg.filter((m: any) => (m.message_length || 0) < 20).length / curCount) * 20
  );

  return Math.min(100, Math.max(0, vocabScore));
}

export async function scoreTeam(teamId: string, orgId: string): Promise<ScoreResult | null> {
  const windowDays = 7;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const baseStart = new Date(Date.now() - (BASELINE_WEEKS + 1) * 7 * 24 * 60 * 60 * 1000);
  const baseEnd = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  try {
    const memberResult = await db('biomarker_events')
      .where({ team_id: teamId, org_id: orgId })
      .where('event_time', '>=', since)
      .countDistinct('member_hash as count')
      .first();
    const uniqueMembers = parseInt(memberResult?.count as string || '0', 10);

    if (uniqueMembers < MIN_MEMBERS) {
      logger.warn({ teamId, uniqueMembers }, 'Insufficient members for scoring (privacy threshold)');
      return null;
    }

    const current = await db('biomarker_events')
      .where({ team_id: teamId, org_id: orgId })
      .where('event_time', '>=', since)
      .select('*');

    const baseline = await db('biomarker_events')
      .where({ team_id: teamId, org_id: orgId })
      .where('event_time', '>=', baseStart)
      .where('event_time', '<', baseEnd)
      .select('*');

    const curSentMsg = current.filter((e: any) => e.event_type === 'message' && e.sentiment_score != null);
    const baseSentMsg = baseline.filter((e: any) => e.event_type === 'message' && e.sentiment_score != null);
    const curAfterHours = current.filter((e: any) => e.is_after_hours === true);
    const baseAfterHours = baseline.filter((e: any) => e.is_after_hours === true);

    let sentimentScore: number;
    const nlpSentResult = await callNlpService('sentiment', {
      teamId, orgId,
      windowStart: since.toISOString(),
    });
    sentimentScore = nlpSentResult?.score ?? fallbackSentimentScore(curSentMsg);

    const currentTotal = current.length;
    const baselineTotal = baseline.length;
    const curAHRatio = currentTotal > 0 ? curAfterHours.length / currentTotal : 0;
    const baseAHRatio = baselineTotal > 0 ? baseAfterHours.length / baselineTotal : 0;
    const afterHoursScore = Math.min(100, Math.max(0, Math.round((curAHRatio - baseAHRatio) * 200)));

    const userHours = new Map<string, number[]>();
    for (const event of current) {
      const hash = (event as any).member_hash;
      if (!hash) continue;
      if (!userHours.has(hash)) userHours.set(hash, []);
      userHours.get(hash)!.push((event as any).hour_of_day);
    }

    let totalStdDev = 0;
    let latencyCount = 0;
    for (const [, hours] of userHours) {
      if (hours.length < 3) continue;
      totalStdDev += circularHourStdDev(hours);
      latencyCount++;
    }
    const avgLatencyDrift = latencyCount > 0 ? totalStdDev / latencyCount : 0;
    const latencyScore = Math.min(100, Math.max(0, Math.round(avgLatencyDrift * 8)));

    let vocabScore: number;
    const nlpVocabResult = await callNlpService('vocab-shift', {
      teamId, orgId,
      windowStart: since.toISOString(),
      baselineStart: baseStart.toISOString(),
    });
    vocabScore = nlpVocabResult?.score ?? fallbackVocabScore(curSentMsg, baseSentMsg);

    const compositeScore = Math.round(
      sentimentScore * WEIGHTS.sentiment +
      afterHoursScore * WEIGHTS.afterHours +
      latencyScore * WEIGHTS.latency +
      vocabScore * WEIGHTS.vocabShift
    );

    const avgSentiment = curSentMsg.length > 0
      ? curSentMsg.reduce((s: number, m: any) => s + (m.sentiment_score || 0), 0) / curSentMsg.length
      : 0;

    const prevScore = await db('team_scores')
      .where({ team_id: teamId })
      .orderBy('period_end', 'desc')
      .first();

    const prevRisk = prevScore?.risk_level;
    const consecutiveWeeks = prevRisk && prevRisk !== 'low'
      ? (prevScore?.consecutive_weeks_triggered || 0) + 1
      : 0;
    const isSustained = consecutiveWeeks >= 3;

    let riskLevel: 'low' | 'moderate' | 'elevated' | 'high';
    if (compositeScore >= 70) riskLevel = 'high';
    else if (compositeScore >= 50) riskLevel = 'elevated';
    else if (compositeScore >= 30) riskLevel = 'moderate';
    else riskLevel = 'low';

    const result: ScoreResult = {
      teamId,
      orgId,
      compositeScore,
      scores: {
        sentiment: sentimentScore,
        afterHours: afterHoursScore,
        latency: latencyScore,
        vocabShift: vocabScore,
      },
      rawStats: {
        uniqueMembersContributing: uniqueMembers,
        totalEvents: currentTotal,
        avgSentiment,
        avgAfterHoursRatio: curAHRatio,
        avgLatencyMinutes: Math.round(avgLatencyDrift * 60),
        windowDays,
      },
      periodStart: since.toISOString(),
      periodEnd: new Date().toISOString(),
      riskLevel,
      consecutiveWeeksTriggered: consecutiveWeeks,
      isSustained,
    };

    await db('team_scores').insert({
      org_id: orgId,
      team_id: teamId,
      composite_score: compositeScore,
      sentiment_score: sentimentScore,
      after_hours_score: afterHoursScore,
      latency_score: latencyScore,
      vocab_shift_score: vocabScore,
      risk_level: riskLevel,
      unique_members: uniqueMembers,
      total_events: currentTotal,
      period_start: since,
      period_end: new Date(),
      consecutive_weeks_triggered: consecutiveWeeks,
      is_sustained: isSustained,
    });

    logger.info({ teamId, compositeScore, riskLevel }, 'Team scored successfully');
    return result;
  } catch (err) {
    logger.error({ err, teamId, orgId }, 'Failed to score team');
    throw err;
  }
}

export async function generatePulseReport(teamId: string, orgId: string, score: ScoreResult): Promise<any> {
  try {
    const nlpUrl = process.env.NLP_SERVICE_URL || 'http://localhost:5001';
    const apiKey = process.env.NLP_SERVICE_API_KEY || 'internal_service_key';

    let narrative = '';
    let recommendations: string[] = [];
    let keyFactors: string[] = [];

    try {
      const reportRes = await fetch(`${nlpUrl}/generate-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          teamId, orgId,
          compositeScore: score.compositeScore,
          riskLevel: score.riskLevel,
          scores: score.scores,
          rawStats: score.rawStats,
          consecutiveWeeksTriggered: score.consecutiveWeeksTriggered,
          isSustained: score.isSustained,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (reportRes.ok) {
        const reportData = await reportRes.json();
        narrative = reportData.narrative || '';
        recommendations = reportData.recommendations || [];
        keyFactors = reportData.key_factors || [];
      } else {
        throw new Error('NLP report generation failed');
      }
    } catch (err) {
      logger.warn({ err }, 'NLP report generation unavailable, using template');
      narrative = generateTemplateNarrative(score);
      recommendations = generateRecommendations(score);
      keyFactors = generateKeyFactors(score);
    }

    await db('pulse_reports').insert({
      org_id: orgId,
      team_id: teamId,
      period_start: new Date(score.periodStart),
      period_end: new Date(score.periodEnd),
      narrative,
      composite_score: score.compositeScore,
      risk_level: score.riskLevel,
      key_factors: keyFactors,
      recommendations: recommendations,
    });

    const existingAlert = await db('alerts')
      .where({ org_id: orgId, team_id: teamId, alert_type: score.isSustained ? 'sustained_burnout_risk' : 'burnout_risk', is_resolved: false })
      .first();

    if ((score.riskLevel === 'elevated' || score.riskLevel === 'high') && !existingAlert) {
      await db('alerts').insert({
        org_id: orgId,
        team_id: teamId,
        alert_type: score.isSustained ? 'sustained_burnout_risk' : 'burnout_risk',
        severity: score.riskLevel === 'high' ? 'critical' : 'warning',
        message: `${score.riskLevel === 'high' ? 'Critical' : 'Elevated'} burnout risk detected for team. Composite score: ${score.compositeScore}. ${score.isSustained ? 'This pattern has persisted for multiple weeks.' : ''}`,
      });
    }

    return { narrative, recommendations, keyFactors };
  } catch (err) {
    logger.error({ err, teamId }, 'Failed to generate pulse report');
    throw err;
  }
}

function generateTemplateNarrative(score: ScoreResult): string {
  if (score.riskLevel === 'low') {
    return 'This team is showing healthy wellbeing indicators. All biomarker metrics are within normal ranges. Continue monitoring for any changes in communication patterns.';
  } else if (score.riskLevel === 'moderate') {
    return `This team is showing early signs of increased stress. Sentiment scores have shifted ${score.scores.sentiment > 50 ? 'negatively' : 'slightly'}, and there are some changes in communication patterns. Consider a proactive check-in with the team lead.`;
  } else if (score.riskLevel === 'elevated') {
    return `This team has shown a ${score.scores.sentiment > 60 ? 'significant' : 'moderate'} decline in wellbeing indicators. ${score.rawStats.avgAfterHoursRatio > 0.3 ? 'After-hours communication has increased substantially. ' : ''}${score.scores.latency > 60 ? 'Response latency drift suggests cognitive overload. ' : ''}Recommended intervention: workload audit and team retrospective.`;
  } else {
    return `This team is at critical risk of collective burnout. Multiple biomarkers are in the danger zone. ${score.isSustained ? 'This pattern has persisted for several weeks, indicating structural rather than situational causes. ' : ''}Immediate intervention recommended: scope reduction, time-off redistribution, and 1:1 support.`;
  }
}

function generateRecommendations(score: ScoreResult): string[] {
  const recs: string[] = [];
  if (score.riskLevel === 'elevated' || score.riskLevel === 'high') {
    if (score.scores.sentiment > 60) recs.push('Schedule a team retrospective to address communication concerns');
    if (score.rawStats.avgAfterHoursRatio > 0.3) {
      recs.push('Review workload distribution and set boundaries on after-hours communication');
      recs.push('Consider implementing a "no messages after 6pm" team agreement');
    }
    if (score.scores.latency > 60) {
      recs.push('Evaluate current sprint commitments and consider reducing scope');
      recs.push('Introduce focus time blocks with no meeting interruptions');
    }
    if (score.isSustained) {
      recs.push('Engage with Employee Assistance Program (EAP) resources for team support');
      recs.push('Conduct structured 1:1 conversations using the provided conversation guide');
    }
    recs.push('Monitor team wellbeing indicators for improvement over the next 2 weeks');
  } else if (score.riskLevel === 'moderate') {
    recs.push('Proactive check-in with team lead about communication patterns');
    recs.push('Review upcoming workload and identify potential stress points');
  } else {
    recs.push('Continue current practices — team wellbeing indicators are healthy');
    recs.push('Schedule regular pulse checks to maintain awareness');
  }
  return recs;
}

function generateKeyFactors(score: ScoreResult): string[] {
  const factors: string[] = [];
  if (score.scores.sentiment > 60) factors.push('Declining message sentiment');
  if (score.rawStats.avgAfterHoursRatio > 0.3) factors.push('Elevated after-hours activity');
  if (score.scores.latency > 60) factors.push('Response latency drift');
  if (score.scores.vocabShift > 60) factors.push('Vocabulary shift indicating disengagement');
  if (score.isSustained) factors.push('Sustained pattern over multiple weeks');
  if (factors.length === 0) factors.push('All biomarkers within normal range');
  return factors;
}
