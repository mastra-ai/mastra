import { serve } from '@hono/node-server';
import { httpInstrumentationMiddleware } from '@hono/otel';
import { stopTelemetry } from '@mastra/hono-multi-instrumentation';
import { Hono } from 'hono';
import { serviceMastraClient } from './service-mastra-client';

const app = new Hono();

app.use(httpInstrumentationMiddleware());

app.get('/service-two', async c => {
  try {
    const response = await serviceMastraClient.getMessage('http://localhost:3002');
    const message = 'service-two response. Response from service-mastra: "' + response.message + '"';
    return c.json({ message: message, traceId: response.traceId });
  } catch (error) {
    console.error('[service-two] Failed to call service-mastra:', error);
    return c.json(
      { error: 'Failed to call service-mastra', details: error instanceof Error ? error.message : 'Unknown error' },
      502,
    );
  }
});

app.get('/healthz', c => {
  return c.json({ status: 'ok', service: 'service-two' });
});

const port = 3001;
const server = serve({
  port,
  fetch: app.fetch,
});

console.log(`[service-two] Server listening on http://localhost:${port}`);

const gracefulShutdown = async (signal: string) => {
  console.log(`[service-two] Received ${signal}, shutting down gracefully...`);

  await new Promise<void>((resolve, reject) => {
    server.close(err => {
      if (err) {
        console.error('[service-two] Error closing server:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });

  await stopTelemetry();
  console.log('[service-two] Shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
