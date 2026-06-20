import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../agent/thread-stream-runtime';
import type { TracingContext, TracingOptions } from '../observability';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

function createAgent() {
  return new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });
}

function createMockStreamResponse(runId: string) {
  const chunks: any[] = [
    { type: 'start', runId },
    { type: 'text-start', runId, payload: { id: 'msg-1' } },
    { type: 'text-delta', runId, payload: { id: 'msg-1', text: 'Hello' } },
    { type: 'text-end', runId, payload: { id: 'msg-1' } },
    {
      type: 'finish',
      runId,
      payload: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, finishReason: 'stop' },
    },
  ];

  let finish!: () => void;
  const finished = new Promise<void>(resolve => {
    finish = resolve;
  });
  const fullStream = new ReadableStream({
    start(controller) {
      for (const part of chunks) controller.enqueue(part);
      controller.close();
      finish();
    },
  });

  return {
    runId,
    status: 'running' as const,
    fullStream,
    _waitUntilFinished: () => finished,
  };
}

describe('Harness tracing propagation', () => {
  let agent: Agent;
  let harness: Harness;
  let streamSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
    agent = createAgent();
    harness = new Harness({
      id: 'test-harness',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });

    streamSpy = vi.spyOn(agent, 'stream').mockImplementation(async (_signal: any, options: any) => {
      const response = createMockStreamResponse(options?.runId ?? 'mock-run-id');
      agentThreadStreamRuntime.registerRun(agent, response as any, options);
      return response as any;
    });

    (harness as any).currentThreadId = 'test-thread-123';
  });

  it('should forward tracingContext to agent.stream() when provided', async () => {
    const mockSpan = { spanContext: () => ({ traceId: 'abc', spanId: 'def' }) };
    const tracingContext: TracingContext = { currentSpan: mockSpan as any };

    await harness.session.sendMessage({ content: 'hello', tracingContext });

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

    await harness.session.sendMessage({ content: 'hello', tracingOptions });

    expect(streamSpy).toHaveBeenCalledTimes(1);

    const [, streamOptions] = streamSpy.mock.calls[0]!;

    expect(streamOptions).toHaveProperty('tracingOptions');
    expect((streamOptions as any).tracingOptions).toBe(tracingOptions);
  });

  it('should not include tracingContext/tracingOptions when not provided', async () => {
    await harness.session.sendMessage({ content: 'hello' });

    expect(streamSpy).toHaveBeenCalledTimes(1);

    const [, streamOptions] = streamSpy.mock.calls[0]!;

    expect(streamOptions).not.toHaveProperty('tracingContext');
    expect(streamOptions).not.toHaveProperty('tracingOptions');
  });

  it('starts a new message with a clean abort state after a stale operation was aborted', async () => {
    const events: Array<{ type: string; reason?: string }> = [];
    harness.session.subscribe(event => {
      events.push(event as { type: string; reason?: string });
    });
    harness.session.run.requestAbort();

    await harness.session.sendMessage({ content: 'hello' });

    expect(events).toContainEqual({ type: 'agent_end', reason: 'complete' });
  });
});
