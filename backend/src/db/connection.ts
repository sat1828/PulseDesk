import dotenv from 'dotenv';
dotenv.config();

import knex, { Knex } from 'knex';

const db: Knex = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL || {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'pulsedesk',
    user: process.env.DB_USER || 'pulsedesk',
    password: process.env.DB_PASSWORD || 'pulsedesk_secret',
  },
  pool: { min: 2, max: 10 },
});

export default db;
