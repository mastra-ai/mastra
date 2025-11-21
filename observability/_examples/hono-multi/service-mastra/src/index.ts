/**
 * Service Mastra - Mastra agent service
 *
 * Receives requests from service-two and responds using a Mastra agent.
 * Demonstrates OtelBridge integration for proper trace context propagation.
 */

import { serve } from '@hono/node-server';
import { Mastra } from '@mastra/core/mastra';
import { Observability } from '@mastra/observability';
import { OtelBridge } from '@mastra/otel-bridge';
import { startTelemetry, stopTelemetry } from '@mastra/hono-multi-instrumentation';
import { config } from 'dotenv';
import { Hono } from 'hono';
import { greetingAgent } from './agent.js';

// Load environment variables
config();

// Initialize telemetry FIRST, before Mastra
startTelemetry('service-mastra');

// Create Mastra instance with OtelBridge
const mastra = new Mastra({
  agents: { greetingAgent },
  workflows: {},
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'service-mastra',
        bridge: new OtelBridge(),
      },
    },
  }),
});

const PORT = Number(process.env.PORT) || 4000;

const app = new Hono();

app.get('/chain', async c => {
  console.log('[service-mastra] Received request, calling agent');

  try {
    const result = await greetingAgent.generate([
      {
        role: 'user',
        content: 'Say hello in 3 words',
      },
    ]);

    const message = `service-mastra (agent: ${result.text})`;

    console.log('[service-mastra] Agent response:', result.text);
    console.log('[service-mastra] TraceID:', result.traceId);

    return c.json({
      message,
      traceId: result.traceId,
    });
  } catch (error) {
    console.error('[service-mastra] Error calling agent:', error);
    return c.json({ error: 'Failed to call agent' }, 500);
  }
});

app.get('/health', c => {
  return c.json({ status: 'ok', service: 'service-mastra' });
});

const server = serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`[service-mastra] Server listening on http://localhost:${PORT}`);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`[service-mastra] Received ${signal}, shutting down...`);
  server.close();
  await stopTelemetry();
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
