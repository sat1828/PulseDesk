import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {
  apiRouter, authRouter, teamsRouter, integrationsRouter,
  slackWebhookRouter, alertsRouter, reportsRouter, errorHandler
} from './api/routes';

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests, please try again later' },
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/teams', globalLimiter, teamsRouter);
app.use('/api/integrations', globalLimiter, integrationsRouter);
app.use('/api/alerts', globalLimiter, alertsRouter);
app.use('/api/reports', globalLimiter, reportsRouter);
app.use('/api', globalLimiter, apiRouter);
app.use('/api/slack', slackWebhookRouter);

app.get('/api/config', (_req, res) => {
  res.json({
    apiUrl: process.env.API_BASE_URL || 'http://localhost:3001',
    slackClientId: process.env.SLACK_CLIENT_ID || '',
  });
});

app.use(errorHandler);

export default app;
