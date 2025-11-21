/**
 * Service Two - Intermediate service
 *
 * Receives requests from service-one and forwards them to service-mastra.
 * Demonstrates trace context propagation through the middle of the chain.
 */

import { serve } from '@hono/node-server';
import { startTelemetry, stopTelemetry } from '@mastra/hono-multi-instrumentation';
import { Hono } from 'hono';

// Initialize telemetry before creating the app
startTelemetry('service-two');

const SERVICE_MASTRA_URL = process.env.SERVICE_MASTRA_URL || 'http://localhost:4000';
const PORT = Number(process.env.PORT) || 3001;

const app = new Hono();

app.get('/chain', async c => {
  console.log('[service-two] Received request, calling service-mastra');

  try {
    const response = await fetch(`${SERVICE_MASTRA_URL}/chain`);
    const data = await response.json();

    const message = `service-two → ${data.message}`;

    console.log('[service-two] Response:', message);

    return c.json({
      message,
      traceId: data.traceId,
    });
  } catch (error) {
    console.error('[service-two] Error calling service-mastra:', error);
    return c.json({ error: 'Failed to call service-mastra' }, 500);
  }
});

app.get('/health', c => {
  return c.json({ status: 'ok', service: 'service-two' });
});

const server = serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`[service-two] Server listening on http://localhost:${PORT}`);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`[service-two] Received ${signal}, shutting down...`);
  server.close();
  await stopTelemetry();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
