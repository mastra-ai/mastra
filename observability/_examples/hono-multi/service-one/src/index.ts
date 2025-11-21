import { serve } from '@hono/node-server';
import { httpInstrumentationMiddleware } from '@hono/otel';
import { stopTelemetry } from '@mastra/hono-multi-instrumentation';
import { Hono } from 'hono';
import { serviceTwoClient } from './service-two-client';

const serviceTwoUrl = `http://localhost:3001`;

const app = new Hono();

app.use(httpInstrumentationMiddleware());

app.get('/service-one', async c => {
  const response = await serviceTwoClient.getMessage(serviceTwoUrl);
  const message = 'service-one response. Response from service-two: ' + response.message;
  return c.json({ message: message });
});

app.get('/health', c => {
  return c.json({ status: 'ok', service: 'service-one' });
});

const server = serve({
  port: Number(process.env.PORT) || 3000,
  fetch: app.fetch,
});

const gracefulShutdown = async (signal: string) => {
  server.close();
  await stopTelemetry();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
