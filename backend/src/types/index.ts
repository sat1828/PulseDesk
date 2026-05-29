import { Request } from 'express';

export interface AuthUser {
  id: string;
  orgId: string;
  role: 'hr_director' | 'hr_manager' | 'c_suite' | 'admin';
  email: string;
  name: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export interface OrgTeam {
  id: string;
  org_id: string;
  name: string;
  slack_channel_id?: string;
  min_members: number;
  created_at: Date;
}

export interface Integration {
  id: string;
  org_id: string;
  provider: 'slack' | 'microsoft_teams';
  workspace_id?: string;
  workspace_name?: string;
  access_token_encrypted: string;
  bot_user_id?: string;
  is_active: boolean;
  installed_by: string;
  last_sync_at: Date;
  created_at: Date;
}

export interface BiomarkerEvent {
  id: string;
  org_id: string;
  team_id: string;
  member_hash: string;
  event_type: 'message' | 'reaction' | 'meeting' | 'after_hours';
  event_time: Date;
  hour_of_day: number;
  day_of_week: number;
  message_length?: number;
  has_question?: boolean;
  sentiment_score?: number;
  is_after_hours?: boolean;
  metadata?: Record<string, unknown>;
  created_at: Date;
}

export interface ScoreResult {
  teamId: string;
  orgId: string;
  compositeScore: number;
  scores: {
    sentiment: number;
    afterHours: number;
    latency: number;
    vocabShift: number;
  };
  rawStats: {
    uniqueMembersContributing: number;
    totalEvents: number;
    avgSentiment: number;
    avgAfterHoursRatio: number;
    avgLatencyMinutes: number;
    windowDays: number;
  };
  periodStart: string;
  periodEnd: string;
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high';
  consecutiveWeeksTriggered: number;
  isSustained: boolean;
}

export interface TeamScore {
  id: string;
  org_id: string;
  team_id: string;
  composite_score: number;
  sentiment_score: number;
  after_hours_score: number;
  latency_score: number;
  vocab_shift_score: number;
  risk_level: 'low' | 'moderate' | 'elevated' | 'high';
  unique_members: number;
  total_events: number;
  period_start: Date;
  period_end: Date;
  consecutive_weeks_triggered: number;
  is_sustained: boolean;
  created_at: Date;
}

export interface PulseReport {
  id: string;
  org_id: string;
  team_id: string;
  period_start: Date;
  period_end: Date;
  narrative: string;
  composite_score: number;
  risk_level: string;
  key_factors: string[];
  recommendations: string[];
  created_at: Date;
}
