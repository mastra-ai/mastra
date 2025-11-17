/**
 * Minimal example showing OpenTelemetry bridge with Hono
 *
 * This demonstrates standard OTEL auto-instrumentation pattern:
 * - OTEL SDK sets up AsyncLocalStorage for context propagation
 * - OtelBridge reads from ambient context automatically
 * - No middleware needed in application code
 */

// IMPORTANT: Import instrumentation FIRST!
// eslint-disable-next-line import/order
import { memoryExporter } from './instrumentation';

import { serve } from '@hono/node-server';
import { httpInstrumentationMiddleware } from '@hono/otel';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Observability } from '@mastra/observability';
import { OtelBridge } from '@mastra/otel-bridge';
import { Hono } from 'hono';

// Create agent instance
const chatAgentDef = new Agent({
  name: 'chat-agent',
  instructions: 'You are a helpful assistant. Keep responses brief.',
  model: 'openai/gpt-4.1-nano', // Using faster model for tests
});

// Configure Mastra with OtelBridge
const mastra = new Mastra({
  agents: { chatAgent: chatAgentDef },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'otel-bridge-example-hono',
        bridge: new OtelBridge(),
      },
    },
  }),
});

// Get the agent from Mastra instance (important for observability)
const chatAgent = mastra.getAgent('chatAgent');

const app = new Hono();

// Add @hono/otel middleware for proper trace context propagation
// This ensures traceparent headers are properly extracted and propagated
app.use('*', httpInstrumentationMiddleware());

// Health check endpoint
app.get('/health', c => {
  return c.json({ status: 'ok' });
});

// Chat endpoint
app.post('/chat', async c => {
  const body = await c.req.json<{ message: string }>();
  const { message } = body;

  if (!message) {
    return c.json({ error: 'Message is required' }, 400);
  }

  try {
    console.info('Request received:', { message });

    // No context extraction needed! Bridge reads from OTEL's ambient context automatically
    const result = await chatAgent.generate([{ role: 'user', content: message }]);

    return c.json({
      response: result.text,
      otelContext: {
        message: 'OTEL context automatically propagated via AsyncLocalStorage',
      },
    });
  } catch (error) {
    console.error('Error processing chat:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Test-only endpoints to inspect captured spans
if (process.env.NODE_ENV === 'test' && memoryExporter) {
  app.get('/test/spans', c => {
    const spans = memoryExporter!.getFinishedSpans();
    // Convert spans to JSON-safe format (they have circular references)
    const serializedSpans = spans.map(span => ({
      name: span.name,
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      parentSpanId: span.parentSpanContext?.spanId,
      kind: span.kind,
      status: span.status,
      attributes: span.attributes,
      startTime: span.startTime,
      endTime: span.endTime,
    }));
    return c.json({ spans: serializedSpans, count: serializedSpans.length });
  });

  app.post('/test/reset-spans', c => {
    memoryExporter!.reset();
    return c.json({ success: true });
  });
}

const PORT = 3458;

serve({
  fetch: app.fetch,
  port: PORT,
});

console.info(`Server running on http://localhost:${PORT}`);
console.info(
  `\nTest with:\ncurl -X POST http://localhost:${PORT}/chat -H "Content-Type: application/json" -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" -d '{"message":"Hello!"}'`,
);
