import { serve } from '@hono/node-server';
import { httpInstrumentationMiddleware } from '@hono/otel';
import { stopTelemetry } from '@mastra/hono-multi-instrumentation';
import { Hono } from 'hono';
import { serviceMastraClient } from './service-mastra-client';

const serviceMastraUrl = `http://localhost:4111`;

const app = new Hono();

app.use(httpInstrumentationMiddleware());

app.get('/service-two', async c => {
  const response = await serviceMastraClient.getMessage(serviceMastraUrl);
  return c.json({
    message: 'service-two response. Response from service-mastra: ' + response.message,
  });
});

app.get('/health', c => {
  return c.json({ status: 'ok', service: 'service-two' });
});

const server = serve({
  port: Number(process.env.PORT) || 3001,
  fetch: app.fetch,
});

const gracefulShutdown = async (signal: string) => {
  server.close();
  await stopTelemetry();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
