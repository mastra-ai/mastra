/**
 * Minimal example showing OpenTelemetry bridge with Fastify
 *
 * This demonstrates Scenario A: HTTP service receiving W3C trace context headers
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from parent examples directory
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

import Fastify from 'fastify';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Observability } from '@mastra/observability';
import { OtelBridge, fastifyPlugin } from '@mastra/otel-bridge';

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
        bridge: new OtelBridge({
          extractFrom: 'headers', // Extract from HTTP headers
          logLevel: 'debug',
        }),
      },
    },
  }),
});

// Get the agent from Mastra instance (important for observability)
const chatAgent = mastra.getAgent('chatAgent');

const fastify = Fastify({
  logger: false,
});

// Register OTEL plugin to extract trace context
await fastify.register(fastifyPlugin);

// Health check endpoint
fastify.get('/health', async (request, reply) => {
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
    const hasOtelContext = !!request.requestContext;
    const otelHeaders = request.requestContext?.get('otel.headers') as
      | { traceparent?: string; tracestate?: string }
      | undefined;

    console.log('Request received:', {
      message,
      hasOtelContext,
      contextKeys: request.requestContext ? Array.from(request.requestContext.keys()) : [],
      otelHeaders,
    });

    // Pass requestContext to agent - this contains extracted OTEL headers
    const result = await chatAgent.generate([{ role: 'user', content: message }], {
      requestContext: request.requestContext,
    });

    return {
      response: result.text,
      otelContext: {
        extracted: hasOtelContext,
        message: hasOtelContext
          ? 'OTEL trace context was successfully extracted from headers'
          : 'No OTEL trace context found in request headers',
        headers: otelHeaders,
      },
    };
  } catch (error) {
    console.error('Error processing chat:', error);
    reply.status(500);
    return { error: 'Internal server error' };
  }
});

const PORT = 3457;

fastify.listen({ port: PORT }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server running on ${address}`);
  console.log(
    `\nTest with:\ncurl -X POST ${address}/chat -H "Content-Type: application/json" -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" -d '{"message":"Hello!"}'`,
  );
});
