/**
 * Chat API route with OTEL context extraction
 *
 * This demonstrates standard OTEL auto-instrumentation pattern:
 * - OTEL SDK sets up AsyncLocalStorage for context propagation (via instrumentation.ts)
 * - OtelBridge reads from ambient context automatically
 * - No middleware or explicit context extraction needed
 */

import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Observability } from '@mastra/observability';
import { OtelBridge } from '@mastra/otel-bridge';

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
        serviceName: 'otel-bridge-example-nextjs-basic',
        bridge: new OtelBridge(),
      },
    },
  }),
});

// Get the agent from Mastra instance (important for observability)
const chatAgent = mastra.getAgent('chatAgent');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    console.info('Request received:', { message });

    // No context extraction needed! Bridge reads from OTEL's ambient context automatically
    const result = await chatAgent.generate([{ role: 'user', content: message }]);

    return Response.json({
      response: result.text,
      otelContext: {
        message: 'OTEL context automatically propagated via AsyncLocalStorage',
      },
    });
  } catch (error) {
    console.error('Error processing chat:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
