import { serve } from '@hono/node-server';
import { httpInstrumentationMiddleware } from '@hono/otel';
import { stopTelemetry } from '@mastra/hono-multi-instrumentation';
import { Hono } from 'hono';
import { serviceTwoClient } from './service-two-client';

const app = new Hono();

app.use(httpInstrumentationMiddleware());

app.get('/service-one', async c => {
  const response = await serviceTwoClient.getMessage('http://localhost:3001');
  const message = 'service-one response. Response from service-two: "' + response.message + '"';
  return c.json({ message: message, traceId: response.traceId });
});

app.get('/healthz', c => {
  return c.json({ status: 'ok', service: 'service-one' });
});

const port = 3000;
const server = serve({
  port,
  fetch: app.fetch,
});

console.log(`[service-one] Server listening on http://localhost:${port}`);

const gracefulShutdown = async (signal: string) => {
  server.close();
  await stopTelemetry();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
