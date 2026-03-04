import { randomBytes } from 'node:crypto';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { LaminarExporter, otelTraceIdToUUID } from '@mastra/laminar';

if (!process.env.LMNR_PROJECT_API_KEY) {
  console.error('Missing LMNR_PROJECT_API_KEY. Set it in your env or .env file.');
  process.exit(1);
}

const traceId = randomBytes(16).toString('hex');
const rootSpanId = randomBytes(8).toString('hex');
const llmSpanId = randomBytes(8).toString('hex');

const now = new Date();

const rootSpan = {
  id: rootSpanId,
  traceId,
  parentSpanId: undefined,
  type: SpanType.AGENT_RUN,
  name: 'laminar smoke',
  startTime: now,
  endTime: new Date(now.getTime() + 25),
  isEvent: false,
  isRootSpan: true,
  tags: ['laminar-smoke'],
  metadata: { sessionId: 'smoke-session', userId: 'smoke-user' },
};

const llmSpan = {
  id: llmSpanId,
  traceId,
  parentSpanId: rootSpanId,
  type: SpanType.MODEL_GENERATION,
  name: 'hello',
  startTime: now,
  endTime: new Date(now.getTime() + 10),
  isEvent: false,
  isRootSpan: false,
  input: { messages: [{ role: 'user', content: 'hi' }] },
  output: { text: 'hello' },
  attributes: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    usage: { inputTokens: 2, outputTokens: 2 },
  },
  metadata: { sessionId: 'smoke-session', userId: 'smoke-user' },
};

const exporter = new LaminarExporter({ realtime: true });
exporter.init?.({ config: { serviceName: 'laminar-smoke' } });

const TIMEOUT_MS = 30000;

const timeoutId = setTimeout(() => {
  console.error('Laminar smoke test timed out');
  process.exit(1);
}, TIMEOUT_MS);

try {
  await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: rootSpan });
  await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: llmSpan });
  await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: llmSpan });
  await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: rootSpan });

  await exporter.shutdown();
  clearTimeout(timeoutId);

  console.log('exported:', {
    traceId,
    traceUUID: otelTraceIdToUUID(traceId),
    service: 'laminar-smoke',
  });
} catch (error) {
  clearTimeout(timeoutId);
  console.error('Laminar smoke test failed:', error);
  try {
    await exporter.shutdown();
  } catch {
    // ignore
  }
  process.exitCode = 1;
}
