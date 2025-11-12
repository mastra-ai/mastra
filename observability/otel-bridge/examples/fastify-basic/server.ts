/**
 * Minimal example showing OpenTelemetry bridge with Fastify
 *
 * This demonstrates standard OTEL auto-instrumentation pattern:
 * - OTEL SDK sets up AsyncLocalStorage for context propagation
 * - OtelBridge reads from ambient context automatically
 * - No plugin registration needed in application code
 */

// IMPORTANT: Import instrumentation FIRST!
// eslint-disable-next-line import/order
import { memoryExporter } from './instrumentation';

import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Observability } from '@mastra/observability';
import { OtelBridge } from '@mastra/otel-bridge';
import Fastify from 'fastify';

// Create agent instance
const chatAgentDef = new Agent({
  name: 'chat-agent',
  instructions: 'You are a helpful assistant. Keep responses brief.',
  model: 'openai/gpt-4o-mini',
});

// Configure Mastra with OtelBridge
const mastra = new Mastra({
  agents: { chatAgent: chatAgentDef },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'otel-bridge-example-fastify',
        bridge: new OtelBridge(),
      },
    },
  }),
});

// Get the agent from Mastra instance (important for observability)
const chatAgent = mastra.getAgent('chatAgent');

const fastify = Fastify({
  logger: false,
});

// No plugin needed! OTEL auto-instrumentation handles context propagation

// Health check endpoint
fastify.get('/health', async (_request, _reply) => {
  return { status: 'ok' };
});

// Chat endpoint
fastify.post<{ Body: { message: string } }>('/chat', async (request, reply) => {
  const { message } = request.body;

  if (!message) {
    reply.status(400);
    return { error: 'Message is required' };
  }

  try {
    console.info('Request received:', { message });

    // No context extraction needed! Bridge reads from OTEL's ambient context automatically
    const result = await chatAgent.generate([{ role: 'user', content: message }]);

    return {
      response: result.text,
      otelContext: {
        message: 'OTEL context automatically propagated via AsyncLocalStorage',
      },
    };
  } catch (error) {
    console.error('Error processing chat:', error);
    reply.status(500);
    return { error: 'Internal server error' };
  }
});

// Test-only endpoints to inspect captured spans
if (process.env.NODE_ENV === 'test' && memoryExporter) {
  fastify.get('/test/spans', async (_request, _reply) => {
    const spans = memoryExporter!.getFinishedSpans();
    return { spans };
  });

  fastify.post('/test/reset-spans', async (_request, _reply) => {
    memoryExporter!.reset();
    return { success: true };
  });
}

const PORT = 3457;

fastify.listen({ port: PORT }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.info(`Server running on ${address}`);
  console.info(
    `\nTest with:\ncurl -X POST ${address}/chat -H "Content-Type: application/json" -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" -d '{"message":"Hello!"}'`,
  );
});
