import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../db/connection';
import { authenticate, requireRole, generateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { ingestionQueue, scheduleScoring } from '../jobs/workers';
import { scoreTeam, generatePulseReport } from '../services/biomarkerScoring';
import { logger } from '../services/logger';
import { encrypt } from '../crypto/index';

export const apiRouter = Router();
export const authRouter = Router();
export const teamsRouter = Router();
export const integrationsRouter = Router();
export const slackWebhookRouter = Router();
export const alertsRouter = Router();
export const reportsRouter = Router();

// ─── Health Check ───
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'pulsedesk-api', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ─── Auth Routes ───
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await db('users').where({ email, is_active: true }).first();
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      id: user.id,
      orgId: user.org_id,
      role: user.role,
      email: user.email,
      name: user.name,
    });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.org_id },
    });
  } catch (err) { next(err); }
});

authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, orgName, orgSlug } = req.body;
    if (!email || !password || !name || !orgName || !orgSlug) {
      res.status(400).json({ error: 'All fields are required' });
      return;
    }

    const existing = await db('users').where({ email }).first();
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const orgSlugExists = await db('organisations').where({ slug: orgSlug }).first();
    if (orgSlugExists) {
      res.status(409).json({ error: 'Organization slug already taken' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);

    const [org] = await db('organisations').insert({
      name: orgName,
      slug: orgSlug,
    }).returning('*');

    const [user] = await db('users').insert({
      org_id: org.id,
      email,
      password_hash: hash,
      name,
      role: 'admin',
    }).returning('*');

    const token = generateToken({
      id: user.id,
      orgId: org.id,
      role: user.role,
      email: user.email,
      name: user.name,
    });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, orgId: org.id },
      org: { id: org.id, name: org.name, slug: org.slug },
    });
  } catch (err) { next(err); }
});

authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await db('users').where({ id: req.user!.id }).first();
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.org_id });
  } catch (err) { next(err); }
});

// ─── Teams Routes ───
teamsRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const teams = await db('teams').where({ org_id: req.user!.orgId, is_active: true }).select('*').orderBy('name');
    res.json(teams);
  } catch (err) { next(err); }
});

teamsRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const team = await db('teams').where({ id: req.params.id, org_id: req.user!.orgId }).first();
    if (!team) { res.status(404).json({ error: 'Team not found' }); return; }
    res.json(team);
  } catch (err) { next(err); }
});

teamsRouter.post('/', authenticate, requireRole('admin', 'hr_director'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, slackChannelId, slackChannelName } = req.body;
    if (!name) { res.status(400).json({ error: 'Team name is required' }); return; }

    const [team] = await db('teams').insert({
      org_id: req.user!.orgId,
      name,
      slack_channel_id: slackChannelId,
      slack_channel_name: slackChannelName,
    }).returning('*');

    res.status(201).json(team);
  } catch (err) { next(err); }
});

teamsRouter.post('/:id/score-now', authenticate, requireRole('hr_director', 'admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const team = await db('teams').where({ id: req.params.id, org_id: req.user!.orgId }).first();
    if (!team) { res.status(404).json({ error: 'Team not found' }); return; }

    await scheduleScoring(req.user!.orgId, team.id, true);
    res.json({ message: 'Scoring initiated', teamId: team.id });
  } catch (err) { next(err); }
});

teamsRouter.get('/:id/scores', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const scores = await db('team_scores')
      .where({ team_id: req.params.id, org_id: req.user!.orgId })
      .orderBy('period_end', 'desc')
      .limit(13);
    res.json(scores);
  } catch (err) { next(err); }
});

teamsRouter.get('/:id/report', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const report = await db('pulse_reports')
      .where({ team_id: req.params.id, org_id: req.user!.orgId })
      .orderBy('period_end', 'desc')
      .first();
    if (!report) { res.status(404).json({ error: 'No report found for this team' }); return; }
    res.json(report);
  } catch (err) { next(err); }
});

// ─── Integrations Routes ───
integrationsRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const integrations = await db('integrations')
      .where({ org_id: req.user!.orgId })
      .select('id', 'provider', 'workspace_name', 'workspace_id', 'is_active', 'last_sync_at', 'created_at');
    res.json(integrations);
  } catch (err) { next(err); }
});

integrationsRouter.get('/slack/connect', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const state = Buffer.from(JSON.stringify({ orgId: user.orgId, userId: user.id, ts: Date.now() })).toString('base64');

    await db('oauth_states').insert({ state, org_id: user.orgId, created_at: new Date() });

    const params = new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID || '',
      scope: 'channels:history,channels:read,groups:history,groups:read,mpim:history,im:history,users:read,chat:write,reactions:read',
      user_scope: '',
      redirect_uri: `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/integrations/slack/callback`,
      state,
    });

    res.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
  } catch (err) { next(err); }
});

integrationsRouter.get('/slack/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/integrations?error=slack_denied`);
      return;
    }

    const storedState = await db('oauth_states').where({ state }).first();
    if (!storedState) {
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/integrations?error=invalid_state`);
      return;
    }
    await db('oauth_states').where({ state }).delete();

    const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());

    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID || '',
        client_secret: process.env.SLACK_CLIENT_SECRET || '',
        code: code as string,
        redirect_uri: `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/integrations/slack/callback`,
      }),
    });

    const tokenData = await tokenRes.json() as any;
    if (!tokenData.ok) {
      logger.error({ slackError: tokenData.error }, 'Slack OAuth failed');
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/integrations?error=slack_auth_failed`);
      return;
    }

    const encryptedToken = encrypt(tokenData.access_token);

    await db('integrations').insert({
      id: crypto.randomUUID(),
      org_id: stateData.orgId,
      provider: 'slack',
      workspace_id: tokenData.team?.id,
      workspace_name: tokenData.team?.name,
      access_token_encrypted: encryptedToken,
      bot_user_id: tokenData.bot_user_id,
      is_active: true,
      installed_by: stateData.userId,
      last_sync_at: new Date(),
    }).onConflict(['org_id', 'provider']).merge([
      'access_token_encrypted',
      'workspace_name',
      'is_active',
      'last_sync_at',
      'bot_user_id',
    ]);

    await db('organisations').where({ id: stateData.orgId }).update({ slack_connected: true });

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/integrations?success=slack`);
  } catch (err) { next(err); }
});

integrationsRouter.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const integration = await db('integrations').where({ id: req.params.id, org_id: req.user!.orgId }).first();
    if (!integration) { res.status(404).json({ error: 'Integration not found' }); return; }

    await db('integrations').where({ id: req.params.id }).update({ is_active: false });
    await db('organisations').where({ id: req.user!.orgId }).update({
      slack_connected: integration.provider === 'slack' ? false : undefined,
      teams_connected: integration.provider === 'microsoft_teams' ? false : undefined,
    });

    res.json({ message: 'Integration deactivated' });
  } catch (err) { next(err); }
});

// ─── Slack Webhooks ───
slackWebhookRouter.post('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;

    if (body.type === 'url_verification') {
      res.json({ challenge: body.challenge });
      return;
    }

    const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;

    if (slackSigningSecret && signature && timestamp) {
      const sigBasestring = `v0:${timestamp}:${JSON.stringify(body)}`;
      const computedSig = 'v0=' + crypto.createHmac('sha256', slackSigningSecret)
        .update(sigBasestring)
        .digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSig))) {
        logger.warn('Invalid Slack signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    const event = body.event;
    if (!event) {
      res.status(200).json({ ok: true });
      return;
    }

    const integration = await db('integrations')
      .where({ workspace_id: body.team_id, provider: 'slack', is_active: true })
      .first();

    if (!integration) {
      logger.warn({ teamId: body.team_id }, 'No active integration found for Slack workspace');
      res.status(200).json({ ok: true });
      return;
    }

    const team = await db('teams')
      .where({ org_id: integration.org_id, slack_channel_id: event.channel })
      .first();

    if (!team) {
      res.status(200).json({ ok: true });
      return;
    }

    if (event.type === 'message' && !event.subtype && event.user) {
      const eventTime = new Date(parseInt((event.ts as string).split('.')[0], 10) * 1000).toISOString();
      const hourOfDay = new Date(eventTime).getHours();
      const dayOfWeek = new Date(eventTime).getDay();
      const isAfterHours = dayOfWeek === 0 || dayOfWeek === 6 || hourOfDay < 8 || hourOfDay >= 18;

      await ingestionQueue.add('slack_msg', {
        orgId: integration.org_id,
        teamId: team.id,
        slackUserId: event.user,
        eventTime,
        messageLength: event.text?.length || 0,
        hasQuestion: (event.text || '').includes('?'),
        sentimentScore: null,
        isAfterHours,
      });
    }

    if (event.type === 'reaction_added' && event.user) {
      const eventTime = new Date(parseInt((event.event_ts as string).split('.')[0], 10) * 1000).toISOString();

      await ingestionQueue.add('slack_reaction', {
        orgId: integration.org_id,
        teamId: team.id,
        slackUserId: event.user,
        eventTime,
        reactionType: event.reaction,
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) { next(err); }
});

// ─── Alerts Routes ───
alertsRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { teamId, unresolved } = req.query;
    let query = db('alerts').where({ org_id: req.user!.orgId });

    if (teamId) query = query.andWhere({ team_id: teamId });
    if (unresolved === 'true') query = query.andWhere({ is_resolved: false });

    const alerts = await query.orderBy('created_at', 'desc').limit(50);
    res.json(alerts);
  } catch (err) { next(err); }
});

alertsRouter.patch('/:id/resolve', authenticate, requireRole('hr_director', 'admin'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const alert = await db('alerts').where({ id: req.params.id, org_id: req.user!.orgId }).first();
    if (!alert) { res.status(404).json({ error: 'Alert not found' }); return; }

    await db('alerts').where({ id: req.params.id }).update({
      is_resolved: true,
      resolved_at: new Date(),
    });

    res.json({ message: 'Alert resolved' });
  } catch (err) { next(err); }
});

// ─── Reports Routes ───
reportsRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { teamId, limit } = req.query;
    let query = db('pulse_reports').where({ org_id: req.user!.orgId });
    if (teamId) query = query.andWhere({ team_id: teamId });
    const reports = await query.orderBy('period_end', 'desc').limit(parseInt(limit as string || '10', 10));
    res.json(reports);
  } catch (err) { next(err); }
});

reportsRouter.get('/latest', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const reports = await db('pulse_reports')
      .where({ org_id: req.user!.orgId })
      .join('teams', 'pulse_reports.team_id', 'teams.id')
      .select('pulse_reports.*', 'teams.name as team_name')
      .orderBy('pulse_reports.period_end', 'desc')
      .limit(50);
    res.json(reports);
  } catch (err) { next(err); }
});

// ─── Dashboard / Heatmap Data ───
apiRouter.get('/dashboard/heatmap', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const teams = await db('teams').where({ org_id: req.user!.orgId, is_active: true });

    const teamScores = await Promise.all(
      teams.map(async (team: any) => {
        const latestScore = await db('team_scores')
          .where({ team_id: team.id })
          .orderBy('period_end', 'desc')
          .first();

        return {
          teamId: team.id,
          teamName: team.name,
          slackChannelName: team.slack_channel_name,
          compositeScore: latestScore?.composite_score ?? null,
          riskLevel: latestScore?.risk_level ?? 'insufficient_data',
          sentimentScore: latestScore?.sentiment_score ?? null,
          afterHoursScore: latestScore?.after_hours_score ?? null,
          latencyScore: latestScore?.latency_score ?? null,
          vocabShiftScore: latestScore?.vocab_shift_score ?? null,
          uniqueMembers: latestScore?.unique_members ?? 0,
          isSustained: latestScore?.is_sustained ?? false,
          lastUpdated: latestScore?.period_end ?? null,
        };
      })
    );

    res.json(teamScores);
  } catch (err) { next(err); }
});

apiRouter.get('/dashboard/trends', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { teamId } = req.query;
    let query = db('team_scores')
      .join('teams', 'team_scores.team_id', 'teams.id')
      .where('team_scores.org_id', req.user!.orgId);

    if (teamId) query = query.andWhere('team_scores.team_id', teamId);

    const trends = await query
      .select('team_scores.*', 'teams.name as team_name')
      .orderBy('team_scores.period_end', 'desc')
      .limit(100);

    res.json(trends);
  } catch (err) { next(err); }
});

apiRouter.get('/dashboard/summary', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId;

    const totalTeams = await db('teams').where({ org_id: orgId, is_active: true }).count('id as count').first();
    const scoredTeams = await db('team_scores').where({ org_id: orgId }).distinct('team_id').count('team_id as count').first();

    const highRiskResult = await db.raw(`
      SELECT COUNT(DISTINCT team_id) as count FROM team_scores ts1
      WHERE org_id = ? AND risk_level IN ('elevated', 'high')
      AND period_end = (
        SELECT MAX(period_end) FROM team_scores ts2
        WHERE ts2.team_id = ts1.team_id AND ts2.org_id = ts1.org_id
      )
    `, [orgId]);

    const avgResult = await db.raw(`
      SELECT AVG(composite_score) as avg FROM (
        SELECT DISTINCT ON (team_id) composite_score
        FROM team_scores
        WHERE org_id = ?
        ORDER BY team_id, period_end DESC
      ) latest
    `, [orgId]);

    const totalAlerts = await db('alerts').where({ org_id: orgId, is_resolved: false }).count('id as count').first();

    res.json({
      totalTeams: parseInt(totalTeams?.count as string || '0', 10),
      scoredTeams: parseInt(scoredTeams?.count as string || '0', 10),
      highRiskTeams: parseInt(highRiskResult?.rows?.[0]?.count || '0', 10),
      averageCompositeScore: Math.round(parseFloat(avgResult?.rows?.[0]?.avg || '0') * 100) / 100,
      unresolvedAlerts: parseInt(totalAlerts?.count as string || '0', 10),
    });
  } catch (err) { next(err); }
});

// ─── Org (admin only) ───
apiRouter.get('/org', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const org = await db('organisations').where({ id: req.user!.orgId }).first();
    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
    res.json(org);
  } catch (err) { next(err); }
});

// ─── Error handling ───
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  logger.error({ err }, 'Unhandled API error');
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
