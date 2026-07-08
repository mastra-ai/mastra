import type { metrics } from '@livekit/agents';
import { voice } from '@livekit/agents';
import type { Mastra } from '@mastra/core/mastra';
import { describe, expect, it, vi } from 'vitest';
import { startVoiceCallObservability } from './observability';

interface FakeEvent {
  name: string;
  output: unknown;
}

function makeFakeSpan() {
  const events: FakeEvent[] = [];
  const span = {
    // Event spans are recorded at creation (no end); capture name + output.
    createEventSpan: vi.fn((opts: { name: string; output?: unknown }) => {
      const event: FakeEvent = { name: opts.name, output: opts.output };
      events.push(event);
      return event;
    }),
    end: vi.fn(),
    error: vi.fn(),
    events,
  };
  return span;
}

// Exercises the real getOrCreateSpan path: it reads mastra.observability.getSelectedInstance().startSpan().
function mastraWithSpan(span: unknown): Mastra {
  return {
    observability: { getSelectedInstance: () => ({ startSpan: () => span }) },
  } as unknown as Mastra;
}

function makeFakeSession() {
  let onMetrics: ((ev: { metrics: metrics.AgentMetrics }) => void) | undefined;
  let onClose: ((ev: { error?: unknown }) => void) | undefined;
  const session = {
    on: vi.fn((event: string, cb: (ev: never) => void) => {
      if (event === voice.AgentSessionEventTypes.MetricsCollected) {
        onMetrics = cb as unknown as (ev: { metrics: metrics.AgentMetrics }) => void;
      } else if (event === voice.AgentSessionEventTypes.Close) {
        onClose = cb as unknown as (ev: { error?: unknown }) => void;
      }
      return session;
    }),
    emitMetric(metric: metrics.AgentMetrics) {
      onMetrics?.({ metrics: metric });
    },
    close(event: { error?: unknown } = {}) {
      onClose?.(event);
    },
  };
  return session;
}

const baseArgs = {
  agentId: 'callCenter',
  roomName: 'room-1',
  metadata: { threadId: 'thread-1', resourceId: 'user-1' },
};

describe('startVoiceCallObservability', () => {
  it('returns undefined when the Mastra instance has no observability configured', () => {
    expect(startVoiceCallObservability({ mastra: {} as unknown as Mastra, ...baseArgs })).toBeUndefined();
  });

  it('opens a voice call span and exposes it as the tracing parent for agent runs', () => {
    const span = makeFakeSpan();
    const obs = startVoiceCallObservability({ mastra: mastraWithSpan(span), ...baseArgs });
    expect(obs).toBeDefined();
    expect(obs!.span).toBe(span);
    // Threaded into the bridge's stream options so each turn's agent run nests under the call.
    expect(obs!.tracingContext.currentSpan).toBe(span);
  });

  it('records pipeline metrics as event spans with the headline latency in the name', () => {
    const span = makeFakeSpan();
    const obs = startVoiceCallObservability({ mastra: mastraWithSpan(span), ...baseArgs })!;
    const session = makeFakeSession();
    obs.attach(session as unknown as voice.AgentSession);

    session.emitMetric({
      type: 'eou_metrics',
      timestamp: 0,
      endOfUtteranceDelayMs: 120,
      transcriptionDelayMs: 45,
      onUserTurnCompletedDelayMs: 8,
      lastSpeakingTimeMs: 0,
    });
    session.emitMetric({
      type: 'tts_metrics',
      label: 'cartesia',
      requestId: 'r1',
      timestamp: 0,
      ttfbMs: 210,
      durationMs: 400,
      audioDurationMs: 1300,
      cancelled: false,
      charactersCount: 64,
      streamed: true,
      metadata: { modelProvider: 'cartesia', modelName: 'sonic-3' },
    });

    // No .end() on event spans: the value is in the name and the full fields on output.
    expect(span.end).not.toHaveBeenCalled();
    expect(span.events.map(e => e.name)).toEqual(['eou 120ms', 'tts ttfb 210ms']);
    expect(span.events[0]!.output).toMatchObject({ endOfUtteranceDelayMs: 120, transcriptionDelayMs: 45 });
    expect(span.events[1]!.output).toMatchObject({
      ttfbMs: 210,
      charactersCount: 64,
      modelProvider: 'cartesia',
      modelName: 'sonic-3',
    });
  });

  it('closes the call span with a per-model usage roll-up when the session closes', () => {
    const span = makeFakeSpan();
    const obs = startVoiceCallObservability({ mastra: mastraWithSpan(span), ...baseArgs })!;
    const session = makeFakeSession();
    obs.attach(session as unknown as voice.AgentSession);

    session.emitMetric({
      type: 'llm_metrics',
      label: 'mastra',
      requestId: 'r1',
      timestamp: 0,
      durationMs: 900,
      ttftMs: 320,
      cancelled: false,
      completionTokens: 40,
      promptTokens: 200,
      promptCachedTokens: 0,
      totalTokens: 240,
      tokensPerSecond: 44,
      metadata: { modelProvider: 'openai', modelName: 'gpt-5-mini' },
    });

    // The session close event drives finalize — not just the worker's shutdown backstop.
    session.close();

    expect(span.end).toHaveBeenCalledTimes(1);
    const output = span.end.mock.calls[0]![0]?.output as { usage: Array<Record<string, unknown>> };
    const llm = output.usage.find(u => u.type === 'llm_usage');
    expect(llm).toMatchObject({ provider: 'openai', model: 'gpt-5-mini', inputTokens: 200, outputTokens: 40 });
  });

  it('finalize records errors and is idempotent', () => {
    const span = makeFakeSpan();
    const obs = startVoiceCallObservability({ mastra: mastraWithSpan(span), ...baseArgs })!;
    const boom = new Error('start failed');

    obs.finalize({ error: boom });
    obs.finalize();

    expect(span.error).toHaveBeenCalledTimes(1);
    expect(span.error.mock.calls[0]![0]?.error).toBe(boom);
    expect(span.end).not.toHaveBeenCalled();
  });
});
