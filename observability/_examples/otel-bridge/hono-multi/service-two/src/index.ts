import { serve } from '@hono/node-server';
import { httpInstrumentationMiddleware } from '@hono/otel';
import { stopTelemetry } from '@mastra/hono-multi-instrumentation';
import { Hono } from 'hono';
import { serviceMastraClient } from './service-mastra-client';

const app = new Hono();

app.use(httpInstrumentationMiddleware());

app.get('/service-two', async c => {
  const response = await serviceMastraClient.getMessage('http://localhost:3002');
  const message = 'service-two response. Response from service-mastra: "' + response.message + '"';
  return c.json({ message: message, traceId: response.traceId });
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
  server.close();
  await stopTelemetry();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
