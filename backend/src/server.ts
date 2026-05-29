import app from './app';
import { logger } from './services/logger';
import { startWorkers, stopWorkers } from './jobs/workers';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function start() {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'Starting PulseDesk API server');

  startWorkers();

  const server = app.listen(PORT, () => {
    logger.info(`PulseDesk API server running on port ${PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    server.close();
    await stopWorkers();
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
