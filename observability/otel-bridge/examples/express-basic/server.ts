/**
 * Minimal example showing OpenTelemetry bridge with Express
 *
 * This demonstrates standard OTEL auto-instrumentation pattern:
 * - OTEL SDK sets up AsyncLocalStorage for context propagation
 * - OtelBridge reads from ambient context automatically
 * - No middleware needed in application code
 */

// IMPORTANT: Import instrumentation FIRST!
// eslint-disable-next-line import/order
import { memoryExporter } from './instrumentation';

import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Observability } from '@mastra/observability';
import { OtelBridge } from '@mastra/otel-bridge';
import express from 'express';

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
        serviceName: 'otel-bridge-example',
        bridge: new OtelBridge(),
      },
    },
  }),
});

// Get the agent from Mastra instance (important for observability)
const chatAgent = mastra.getAgent('chatAgent');

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    console.info('Request received:', { message });
    const result = await chatAgent.generate([{ role: 'user', content: message }]);

    res.json({
      response: result.text,
      otelContext: {
        message: 'OTEL context automatically propagated via AsyncLocalStorage',
      },
    });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test-only endpoint to inspect captured spans
if (process.env.NODE_ENV === 'test' && memoryExporter) {
  app.get('/test/spans', (_req, res) => {
    const spans = memoryExporter!.getFinishedSpans();
    // Convert spans to JSON-safe format (they have circular references)
    const serializedSpans = spans.map(span => ({
      name: span.name,
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      parentSpanId: span.parentSpanId,
      kind: span.kind,
      status: span.status,
      attributes: span.attributes,
      startTime: span.startTime,
      endTime: span.endTime,
    }));
    res.json({ spans: serializedSpans, count: serializedSpans.length });
  });

  app.post('/test/reset-spans', (_req, res) => {
    memoryExporter!.reset();
    res.json({ success: true });
  });
}

const PORT = 3456;

app.listen(PORT, () => {
  console.info(`Server running on http://localhost:${PORT}`);
  console.info(
    `\nTest with:\ncurl -X POST http://localhost:${PORT}/chat -H "Content-Type: application/json" -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" -d '{"message":"Hello!"}'`,
  );
});
