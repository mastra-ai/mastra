/**
 * Service One - Entry point service
 *
 * Receives HTTP requests and forwards them to service-two.
 * Demonstrates trace context propagation through the service chain.
 */

import { serve } from '@hono/node-server';
import { startTelemetry, stopTelemetry } from '@mastra/hono-multi-instrumentation';
import { Hono } from 'hono';

// Initialize telemetry before creating the app
startTelemetry('service-one');

const SERVICE_TWO_URL = process.env.SERVICE_TWO_URL || 'http://localhost:3001';
const PORT = Number(process.env.PORT) || 3000;

const app = new Hono();

app.get('/chain', async c => {
  console.log('[service-one] Received request, calling service-two');

  try {
    const response = await fetch(`${SERVICE_TWO_URL}/chain`);
    const data = await response.json();

    const message = `service-one → ${data.message}`;

    console.log('[service-one] Response:', message);

    return c.json({
      message,
      traceId: data.traceId,
    });
  } catch (error) {
    console.error('[service-one] Error calling service-two:', error);
    return c.json({ error: 'Failed to call service-two' }, 500);
  }
});

app.get('/health', c => {
  return c.json({ status: 'ok', service: 'service-one' });
});

const server = serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`[service-one] Server listening on http://localhost:${PORT}`);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`[service-one] Received ${signal}, shutting down...`);
  server.close();
  await stopTelemetry();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
