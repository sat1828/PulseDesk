import knex from 'knex';
import dotenv from 'dotenv';
import { logger } from '../services/logger';

dotenv.config();

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL || {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'pulsedesk',
    user: process.env.DB_USER || 'pulsedesk',
    password: process.env.DB_PASSWORD || 'pulsedesk_secret',
  },
  pool: { min: 2, max: 10 },
});

async function migrate() {
  logger.info('Running database migrations...');

  await db.raw(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  await db.schema.createTableIfNotExists('organisations', (table) => {
    table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('slug', 100).notNullable().unique();
    table.boolean('slack_connected').defaultTo(false);
    table.boolean('teams_connected').defaultTo(false);
    table.jsonb('settings').defaultTo('{}');
    table.timestamps(true, true);
  });

  await db.schema.createTableIfNotExists('users', (table) => {
    table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('organisations').onDelete('CASCADE');
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('name', 255).notNullable();
    table.string('role', 50).notNullable().defaultTo('hr_manager');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  await db.schema.createTableIfNotExists('teams', (table) => {
    table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('organisations').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.string('slack_channel_id', 100);
    table.string('slack_channel_name', 255);
    table.integer('min_members').defaultTo(5);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  await db.schema.createTableIfNotExists('biomarker_events', (table) => {
    table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('organisations').onDelete('CASCADE');
    table.uuid('team_id').notNullable().references('id').inTable('teams').onDelete('CASCADE');
    table.text('member_hash').notNullable();
    table.string('event_type', 50).notNullable();
    table.timestamp('event_time', { useTz: true }).notNullable();
    table.integer('hour_of_day').notNullable();
    table.integer('day_of_week').notNullable();
    table.integer('message_length');
    table.boolean('has_question');
    table.float('sentiment_score');
    table.boolean('is_after_hours');
    table.jsonb('metadata').defaultTo('{}');
    table.timestamps(true, true);
  });

  await db.schema.createTableIfNotExists('team_scores', (table) => {
    table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('organisations').onDelete('CASCADE');
    table.uuid('team_id').notNullable().references('id').inTable('teams').onDelete('CASCADE');
    table.float('composite_score').notNullable();
    table.float('sentiment_score').notNullable();
    table.float('after_hours_score').notNullable();
    table.float('latency_score').notNullable();
    table.float('vocab_shift_score').notNullable();
    table.string('risk_level', 20).notNullable();
    table.integer('unique_members').notNullable().defaultTo(0);
    table.integer('total_events').notNullable().defaultTo(0);
    table.timestamp('period_start', { useTz: true }).notNullable();
    table.timestamp('period_end', { useTz: true }).notNullable();
    table.integer('consecutive_weeks_triggered').defaultTo(0);
    table.boolean('is_sustained').defaultTo(false);
    table.timestamps(true, true);
  });

  await db.schema.createTableIfNotExists('pulse_reports', (table) => {
    table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('organisations').onDelete('CASCADE');
    table.uuid('team_id').notNullable().references('id').inTable('teams').onDelete('CASCADE');
    table.timestamp('period_start', { useTz: true }).notNullable();
    table.timestamp('period_end', { useTz: true }).notNullable();
    table.text('narrative').notNullable();
    table.float('composite_score').notNullable();
    table.string('risk_level', 20).notNullable();
    table.jsonb('key_factors').defaultTo('[]');
    table.jsonb('recommendations').defaultTo('[]');
    table.timestamps(true, true);
  });

  await db.schema.createTableIfNotExists('integrations', (table) => {
    table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('organisations').onDelete('CASCADE');
    table.string('provider', 50).notNullable();
    table.string('workspace_id', 100);
    table.string('workspace_name', 255);
    table.text('access_token_encrypted').notNullable();
    table.string('refresh_token_encrypted', 500);
    table.string('bot_user_id', 100);
    table.boolean('is_active').defaultTo(true);
    table.uuid('installed_by').references('id').inTable('users');
    table.timestamp('last_sync_at', { useTz: true });
    table.timestamps(true, true);
    table.unique(['org_id', 'provider']);
  });

  await db.schema.createTableIfNotExists('oauth_states', (table) => {
    table.text('state').primary();
    table.uuid('org_id').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(db.fn.now());
  });

  await db.schema.createTableIfNotExists('calendar_events', (table) => {
    table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('organisations').onDelete('CASCADE');
    table.uuid('team_id').notNullable().references('id').inTable('teams').onDelete('CASCADE');
    table.timestamp('event_time', { useTz: true }).notNullable();
    table.integer('duration_minutes').notNullable();
    table.integer('attendee_count').notNullable().defaultTo(1);
    table.boolean('is_recurring').defaultTo(false);
    table.text('member_hash').notNullable();
    table.timestamps(true, true);
  });

  await db.schema.createTableIfNotExists('alerts', (table) => {
    table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('organisations').onDelete('CASCADE');
    table.uuid('team_id').notNullable().references('id').inTable('teams').onDelete('CASCADE');
    table.string('alert_type', 50).notNullable();
    table.string('severity', 20).notNullable();
    table.text('message').notNullable();
    table.boolean('is_read').defaultTo(false);
    table.boolean('is_resolved').defaultTo(false);
    table.timestamp('resolved_at', { useTz: true });
    table.timestamps(true, true);
  });

  await db.schema.createTableIfNotExists('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    table.uuid('org_id').notNullable().references('id').inTable('organisations').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users');
    table.string('action', 255).notNullable();
    table.jsonb('details').defaultTo('{}');
    table.string('ip_address', 45);
    table.timestamp('created_at', { useTz: true }).defaultTo(db.fn.now());
  });

  await db.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_biomarker_events_team_time 
    ON biomarker_events(team_id, event_time);
  `);
  await db.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_biomarker_events_org_team_time 
    ON biomarker_events(org_id, team_id, event_time);
  `);
  await db.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_biomarker_events_member_hash 
    ON biomarker_events(member_hash);
  `);
  await db.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_team_scores_team_period 
    ON team_scores(team_id, period_start DESC);
  `);
  await db.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_oauth_states_created 
    ON oauth_states(created_at);
  `);
  await db.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_alerts_org_unresolved
    ON alerts(org_id, is_resolved, created_at DESC);
  `);
  await db.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_team_scores_org_latest
    ON team_scores(org_id, team_id, period_end DESC);
  `);
  await db.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_pulse_reports_org_team
    ON pulse_reports(org_id, team_id, period_end DESC);
  `);

  // TTL cleanup: remove oauth_states older than 1 hour
  await db.schema.raw(`
    DELETE FROM oauth_states WHERE created_at < NOW() - INTERVAL '1 hour';
  `);

  logger.info('Migrations completed successfully');
  await db.destroy();
}

migrate().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});

export default db;
