import knex from 'knex';
import crypto from 'crypto';
import dotenv from 'dotenv';

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

async function seed() {
  console.log('Seeding database...');

  const [org] = await db('organisations').insert({
    name: 'Acme Corp',
    slug: 'acme-corp',
  }).returning('*');

  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash('password123', 12);

  const [admin] = await db('users').insert({
    org_id: org.id,
    email: 'admin@acme.com',
    password_hash: hash,
    name: 'Sarah Admin',
    role: 'admin',
  }).returning('*');

  await db('users').insert([
    { org_id: org.id, email: 'hr@acme.com', password_hash: hash, name: 'Mike HR', role: 'hr_director' },
    { org_id: org.id, email: 'c-suite@acme.com', password_hash: hash, name: 'Jane CEO', role: 'c_suite' },
  ]);

  const teams = await db('teams').insert([
    { org_id: org.id, name: 'Platform Engineering', slack_channel_id: 'C001', slack_channel_name: 'platform-eng' },
    { org_id: org.id, name: 'Design Team', slack_channel_id: 'C002', slack_channel_name: 'design' },
    { org_id: org.id, name: 'Data Science', slack_channel_id: 'C003', slack_channel_name: 'data-science' },
    { org_id: org.id, name: 'Customer Success', slack_channel_id: 'C004', slack_channel_name: 'customer-success' },
    { org_id: org.id, name: 'Marketing', slack_channel_id: 'C005', slack_channel_name: 'marketing' },
    { org_id: org.id, name: 'Sales', slack_channel_id: 'C006', slack_channel_name: 'sales' },
    { org_id: org.id, name: 'Product Management', slack_channel_id: 'C007', slack_channel_name: 'product' },
  ]).returning('*');

  const slackUserIds = ['U001', 'U002', 'U003', 'U004', 'U005', 'U006', 'U007', 'U008'];

  for (const team of teams) {
    const teamMemberHashes = slackUserIds.slice(0, 5 + Math.floor(Math.random() * 3)).map((uid) =>
      crypto.createHmac('sha256', org.id).update(uid).digest('hex').slice(0, 16)
    );

    const events: any[] = [];
    const now = Date.now();
    const sixWeeksAgo = now - 42 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 150; i++) {
      const ts = new Date(sixWeeksAgo + Math.random() * (now - sixWeeksAgo));
      const hour = ts.getHours();
      const day = ts.getDay();
      const memberHash = teamMemberHashes[Math.floor(Math.random() * teamMemberHashes.length)];
      const isHighRisk = team.name === 'Platform Engineering' || team.name === 'Customer Success';
      const baseSentiment = isHighRisk ? -0.3 : 0.3;
      const recentBoost = ts > new Date(now - 14 * 24 * 60 * 60 * 1000) ? (isHighRisk ? -0.2 : 0) : 0;

      events.push({
        org_id: org.id,
        team_id: team.id,
        member_hash: memberHash,
        event_type: 'message',
        event_time: ts,
        hour_of_day: hour,
        day_of_week: day,
        message_length: Math.floor(Math.random() * 300) + 10,
        has_question: Math.random() > 0.6,
        sentiment_score: Math.max(-1, Math.min(1, baseSentiment + recentBoost + (Math.random() - 0.5) * 0.4)),
        is_after_hours: hour < 8 || hour >= 18 || day === 0 || day === 6,
      });
    }

    await db('biomarker_events').insert(events);
    console.log(`  Seeded ${events.length} events for ${team.name}`);
  }

  console.log('\nSeed data created successfully!');
  console.log('─── Login Credentials ───');
  console.log('  Admin:     admin@acme.com / password123');
  console.log('  HR:        hr@acme.com / password123');
  console.log('  C-Suite:   c-suite@acme.com / password123');
  console.log(`  Org ID:    ${org.id}`);
  console.log(`  Teams:     ${teams.length} created`);
  console.log('─────────────────────────');

  await db.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
