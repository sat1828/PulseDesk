import { Worker, Queue, Job } from 'bullmq';
import db from '../db/connection';
import { computeMemberHash } from '../crypto/index';
import { logger } from '../services/logger';
import { scoreTeam, generatePulseReport } from '../services/biomarkerScoring';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

export const ingestionQueue = new Queue('ingestion', { connection });
export const scoringQueue = new Queue('scoring', { connection });
export const reportQueue = new Queue('report', { connection });

let ingestionWorker: Worker;
let scoringWorker: Worker;
let reportWorker: Worker;

export function startWorkers() {
  ingestionWorker = new Worker('ingestion', async (job: Job) => {
    const { type } = job.data;
    switch (type) {
      case 'slack_msg':
        await handleSlackMessage(job.data);
        break;
      case 'slack_reaction':
        await handleSlackReaction(job.data);
        break;
      case 'calendar_event':
        await handleCalendarEvent(job.data);
        break;
      default:
        logger.warn({ type }, 'Unknown ingestion job type');
    }
  }, { connection, concurrency: 5 });

  scoringWorker = new Worker('scoring', async (job: Job) => {
    const { orgId, teamId, immediate } = job.data;
    logger.info({ teamId, orgId }, 'Starting team scoring');
    const score = await scoreTeam(teamId, orgId);
    if (!score) {
      logger.warn({ teamId }, 'Scoring returned null (insufficient data)');
      return { scored: false, reason: 'insufficient_members' };
    }
    if (immediate || score.riskLevel !== 'low') {
      await reportQueue.add('generate_report', { orgId, teamId, score });
    }
    return { scored: true, compositeScore: score.compositeScore, riskLevel: score.riskLevel };
  }, { connection, concurrency: 3 });

  reportWorker = new Worker('report', async (job: Job) => {
    const { orgId, teamId, score } = job.data;
    logger.info({ teamId }, 'Generating pulse report');
    const report = await generatePulseReport(teamId, orgId, score);
    return { generated: true, ...report };
  }, { connection, concurrency: 2 });

  logger.info('BullMQ workers started');
}

export async function stopWorkers(): Promise<void> {
  const toClose: (Worker | Queue)[] = [];
  if (ingestionWorker) toClose.push(ingestionWorker);
  if (scoringWorker) toClose.push(scoringWorker);
  if (reportWorker) toClose.push(reportWorker);
  toClose.push(ingestionQueue, scoringQueue, reportQueue);

  await Promise.all(toClose.map(async (w) => {
    try {
      if (w instanceof Worker) {
        await w.close();
      } else {
        await w.close();
      }
    } catch (err) {
      logger.warn({ err }, 'Error closing worker/queue');
    }
  }));

  logger.info('BullMQ workers stopped');
}

async function handleSlackMessage(data: any) {
  const { orgId, teamId, slackUserId, eventTime, messageLength, hasQuestion, sentimentScore, isAfterHours } = data;
  const memberHash = computeMemberHash(orgId, slackUserId);
  const hourOfDay = new Date(eventTime).getHours();
  const dayOfWeek = new Date(eventTime).getDay();

  await db('biomarker_events').insert({
    org_id: orgId,
    team_id: teamId,
    member_hash: memberHash,
    event_type: 'message',
    event_time: eventTime,
    hour_of_day: hourOfDay,
    day_of_week: dayOfWeek,
    message_length: messageLength || 0,
    has_question: hasQuestion || false,
    sentiment_score: sentimentScore ?? 0,
    is_after_hours: isAfterHours || false,
    metadata: {},
  });

  logger.debug({ teamId, memberHash: memberHash.slice(0, 8) }, 'Slack message ingested');
}

async function handleSlackReaction(data: any) {
  const { orgId, teamId, slackUserId, eventTime, reactionType } = data;
  const memberHash = computeMemberHash(orgId, slackUserId);
  const hourOfDay = new Date(eventTime).getHours();
  const dayOfWeek = new Date(eventTime).getDay();

  const positive = new Set(['+1', 'heart', 'joy', 'grinning', 'smile', 'clap', 'tada', 'rocket', 'fire', 'raised_hands']);
  const negative = new Set(['-1', 'angry', 'sob', 'cry', 'disappointed', 'weary', 'confounded']);
  const sentiment: number | null = positive.has(reactionType) ? 0.8 : negative.has(reactionType) ? -0.6 : null;

  await db('biomarker_events').insert({
    org_id: orgId,
    team_id: teamId,
    member_hash: memberHash,
    event_type: 'reaction',
    event_time: eventTime,
    hour_of_day: hourOfDay,
    day_of_week: dayOfWeek,
    sentiment_score: sentiment,
    is_after_hours: isAfterHour(eventTime),
    metadata: { reaction: reactionType },
  });
}

async function handleCalendarEvent(data: any) {
  const { orgId, teamId, eventTime, durationMinutes, attendeeCount, isRecurring } = data;
  const memberHash = computeMemberHash(orgId, data.slackUserId || '');

  await db('calendar_events').insert({
    org_id: orgId,
    team_id: teamId,
    member_hash: memberHash,
    event_time: eventTime,
    duration_minutes: durationMinutes || 30,
    attendee_count: attendeeCount || 1,
    is_recurring: isRecurring || false,
  });
}

function isAfterHour(eventTime: string): boolean {
  const hour = new Date(eventTime).getHours();
  const day = new Date(eventTime).getDay();
  if (day === 0 || day === 6) return true;
  return hour < 8 || hour >= 18;
}

export async function scheduleScoring(orgId: string, teamId: string, immediate = false) {
  await scoringQueue.add('score_team', { orgId, teamId, immediate }, {
    delay: immediate ? 0 : 60_000,
    attempts: 3,
    backoff: { type: 'exponential', delay: 30_000 },
  });
}
