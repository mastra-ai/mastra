/**
 * Chat API route with OTEL context extraction
 */

import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Observability } from '@mastra/observability';
import { OtelBridge, getNextOtelContext } from '@mastra/otel-bridge';

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
        serviceName: 'otel-bridge-example-nextjs',
        bridge: new OtelBridge({
          extractFrom: 'headers',
          logLevel: 'debug',
        }),
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

    // Extract OTEL context from request headers
    const requestContext = getNextOtelContext(request);
    const hasOtelContext = !!requestContext;
    const otelHeaders = requestContext?.get('otel.headers') as
      | { traceparent?: string; tracestate?: string }
      | undefined;

    console.log('Request received:', {
      message,
      hasOtelContext,
      contextKeys: requestContext ? Array.from(requestContext.keys()) : [],
      otelHeaders,
    });

    // Pass requestContext to agent - this contains extracted OTEL headers
    const result = await chatAgent.generate([{ role: 'user', content: message }], {
      requestContext,
    });

    return Response.json({
      response: result.text,
      otelContext: {
        extracted: hasOtelContext,
        message: hasOtelContext
          ? 'OTEL trace context was successfully extracted from headers'
          : 'No OTEL trace context found in request headers',
        headers: otelHeaders,
      },
    });
  } catch (error) {
    console.error('Error processing chat:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
