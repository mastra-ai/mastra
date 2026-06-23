import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../agent';
import type { TracingContext, TracingOptions } from '../observability';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';
import type { Session } from './session';

function createTextStreamModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

function createAgent() {
  return new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: createTextStreamModel('Hello'),
  });
}

describe('Harness tracing propagation', () => {
  let agent: Agent;
  let harness: Harness;
  let session: Session;
  let streamSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    agent = createAgent();
    harness = new Harness({
      id: 'test-harness',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });

    // Spy on the real stream so the run actually completes (driving the
    // session's stream to idle) while still capturing the options it receives.
    const originalStream = agent.stream.bind(agent);
    streamSpy = vi.spyOn(agent, 'stream').mockImplementation((signal: any, options: any) => {
      return originalStream(signal, options);
    });

    await harness.init();
    session = await harness.createSession();
  });

  it('should forward tracingContext to agent.stream() when provided', async () => {
    const mockSpan = { spanContext: () => ({ traceId: 'abc', spanId: 'def' }) };
    const tracingContext: TracingContext = { currentSpan: mockSpan as any };

    await session.sendMessage({ content: 'hello', tracingContext });

    expect(streamSpy).toHaveBeenCalledTimes(1);

    const [, streamOptions] = streamSpy.mock.calls[0]!;

    expect(streamOptions).toHaveProperty('tracingContext');
    expect((streamOptions as any).tracingContext).toBe(tracingContext);
  });

  it('should forward tracingOptions to agent.stream() when provided', async () => {
    const tracingOptions: TracingOptions = {
      traceId: 'abc123',
      parentSpanId: 'def456',
      metadata: { requestId: 'req-789' },
    };

    await session.sendMessage({ content: 'hello', tracingOptions });

    expect(streamSpy).toHaveBeenCalledTimes(1);

    const [, streamOptions] = streamSpy.mock.calls[0]!;

    expect(streamOptions).toHaveProperty('tracingOptions');
    expect((streamOptions as any).tracingOptions).toBe(tracingOptions);
  });

  it('should not include tracingContext/tracingOptions when not provided', async () => {
    await session.sendMessage({ content: 'hello' });

    expect(streamSpy).toHaveBeenCalledTimes(1);

    const [, streamOptions] = streamSpy.mock.calls[0]!;

    expect(streamOptions).not.toHaveProperty('tracingContext');
    expect(streamOptions).not.toHaveProperty('tracingOptions');
  });

  it('starts a new message with a clean abort state after a stale operation was aborted', async () => {
    const events: Array<{ type: string; reason?: string }> = [];
    session.subscribe(event => {
      events.push(event as { type: string; reason?: string });
    });
    session.run.requestAbort();

    await session.sendMessage({ content: 'hello' });

    expect(events.some(event => event.type === 'agent_end' && event.reason === 'complete')).toBe(true);
  });
});
