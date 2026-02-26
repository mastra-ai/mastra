import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../agent';
import type { TracingOptions } from '../observability/types';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

/**
 * Creates a Harness with an agent whose stream method is spied on.
 * The spy captures the options passed to agent.stream() and returns
 * a minimal valid stream response so processStream() completes.
 */
function createHarnessWithStreamSpy() {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  const streamSpy = vi.fn();

  // Replace agent.stream with a spy that captures args and returns a minimal stream
  agent.stream = vi.fn(async (input: any, options: any) => {
    streamSpy(input, options);
    // Return a minimal response with an empty async iterable for fullStream
    return {
      fullStream: (async function* () {
        // Yield a text chunk then finish
        yield { type: 'text-delta', payload: { delta: 'ok' } };
        yield {
          type: 'finish',
          payload: { finishReason: 'stop', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } },
        };
      })(),
      text: Promise.resolve('ok'),
      usage: Promise.resolve({ promptTokens: 1, completionTokens: 1, totalTokens: 2 }),
      finishReason: Promise.resolve('stop'),
      response: Promise.resolve({}),
      rawResponse: Promise.resolve(undefined),
      warnings: Promise.resolve([]),
    };
  }) as any;

  const harness = new Harness({
    id: 'test-harness',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });

  return { harness, agent, streamSpy };
}

describe('Harness tracing propagation', () => {
  describe('sendMessage passes tracingOptions to agent.stream()', () => {
    it('forwards tracingOptions with traceId and parentSpanId', async () => {
      const { harness, streamSpy } = createHarnessWithStreamSpy();
      await harness.init();

      const tracingOptions: TracingOptions = {
        traceId: 'abc123',
        parentSpanId: 'def456',
      };

      await harness.sendMessage({ content: 'hello', tracingOptions });

      expect(streamSpy).toHaveBeenCalledTimes(1);
      const [, options] = streamSpy.mock.calls[0];
      expect(options.tracingOptions).toEqual(tracingOptions);
    });

    it('forwards tracingOptions with all fields', async () => {
      const { harness, streamSpy } = createHarnessWithStreamSpy();
      await harness.init();

      const tracingOptions: TracingOptions = {
        traceId: 'aabbcc',
        parentSpanId: '112233',
        metadata: { userId: 'u-1', env: 'test' },
        tags: ['test-run', 'ci'],
        hideInput: true,
        hideOutput: false,
        requestContextKeys: ['session.id'],
      };

      await harness.sendMessage({ content: 'test', tracingOptions });

      expect(streamSpy).toHaveBeenCalledTimes(1);
      const [, options] = streamSpy.mock.calls[0];
      expect(options.tracingOptions).toEqual(tracingOptions);
      expect(options.tracingOptions.traceId).toBe('aabbcc');
      expect(options.tracingOptions.parentSpanId).toBe('112233');
      expect(options.tracingOptions.metadata).toEqual({ userId: 'u-1', env: 'test' });
      expect(options.tracingOptions.tags).toEqual(['test-run', 'ci']);
      expect(options.tracingOptions.hideInput).toBe(true);
      expect(options.tracingOptions.hideOutput).toBe(false);
    });

    it('does not include tracingOptions key when not provided', async () => {
      const { harness, streamSpy } = createHarnessWithStreamSpy();
      await harness.init();

      await harness.sendMessage({ content: 'hello' });

      expect(streamSpy).toHaveBeenCalledTimes(1);
      const [, options] = streamSpy.mock.calls[0];
      expect(options.tracingOptions).toBeUndefined();
      expect('tracingOptions' in options).toBe(false);
    });
  });

  describe('sendMessage preserves other stream options alongside tracingOptions', () => {
    it('includes memory, requestContext, and tracingOptions together', async () => {
      const { harness, streamSpy } = createHarnessWithStreamSpy();
      await harness.init();

      await harness.sendMessage({
        content: 'hello',
        tracingOptions: { traceId: 'trace1' },
      });

      expect(streamSpy).toHaveBeenCalledTimes(1);
      const [, options] = streamSpy.mock.calls[0];

      // Verify tracingOptions is present
      expect(options.tracingOptions).toEqual({ traceId: 'trace1' });

      // Verify standard stream options are still present
      expect(options.memory).toBeDefined();
      expect(options.memory.thread).toBeDefined();
      expect(options.memory.resource).toBeDefined();
      expect(options.abortSignal).toBeDefined();
      expect(options.requestContext).toBeDefined();
      expect(options.maxSteps).toBe(1000);
      expect(options.modelSettings).toEqual({ temperature: 1 });
    });
  });

  describe('currentTracingOptions is set and cleared correctly', () => {
    it('clears currentTracingOptions after sendMessage completes', async () => {
      const { harness } = createHarnessWithStreamSpy();
      await harness.init();

      await harness.sendMessage({
        content: 'hello',
        tracingOptions: { traceId: 'trace1' },
      });

      // After sendMessage completes, currentTracingOptions should be cleared
      expect((harness as any).currentTracingOptions).toBeUndefined();
    });

    it('clears currentTracingOptions after sendMessage with no tracing', async () => {
      const { harness } = createHarnessWithStreamSpy();
      await harness.init();

      await harness.sendMessage({ content: 'hello' });

      expect((harness as any).currentTracingOptions).toBeUndefined();
    });

    it('clears currentTracingOptions even when stream throws', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'You are a test agent.',
        model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
      });

      agent.stream = vi.fn(async () => {
        throw new Error('stream failed');
      }) as any;

      const harness = new Harness({
        id: 'test-harness',
        storage: new InMemoryStore(),
        modes: [{ id: 'default', name: 'Default', default: true, agent }],
      });

      await harness.init();

      // Subscribe to catch the error event so it doesn't propagate
      const events: any[] = [];
      harness.subscribe(event => {
        events.push(event);
      });

      await harness.sendMessage({
        content: 'hello',
        tracingOptions: { traceId: 'will-fail' },
      });

      // currentTracingOptions should still be cleaned up
      expect((harness as any).currentTracingOptions).toBeUndefined();

      // Verify an error event was emitted
      expect(events.some(e => e.type === 'error')).toBe(true);
    });
  });

  describe('tracingOptions type compatibility', () => {
    it('accepts empty tracingOptions object', async () => {
      const { harness, streamSpy } = createHarnessWithStreamSpy();
      await harness.init();

      await harness.sendMessage({ content: 'hello', tracingOptions: {} });

      expect(streamSpy).toHaveBeenCalledTimes(1);
      const [, options] = streamSpy.mock.calls[0];
      expect(options.tracingOptions).toEqual({});
    });

    it('accepts tracingOptions with only metadata', async () => {
      const { harness, streamSpy } = createHarnessWithStreamSpy();
      await harness.init();

      await harness.sendMessage({
        content: 'hello',
        tracingOptions: { metadata: { source: 'test' } },
      });

      expect(streamSpy).toHaveBeenCalledTimes(1);
      const [, options] = streamSpy.mock.calls[0];
      expect(options.tracingOptions).toEqual({ metadata: { source: 'test' } });
    });

    it('accepts tracingOptions with only tags', async () => {
      const { harness, streamSpy } = createHarnessWithStreamSpy();
      await harness.init();

      await harness.sendMessage({
        content: 'hello',
        tracingOptions: { tags: ['canary', 'v2'] },
      });

      expect(streamSpy).toHaveBeenCalledTimes(1);
      const [, options] = streamSpy.mock.calls[0];
      expect(options.tracingOptions.tags).toEqual(['canary', 'v2']);
    });
  });
});
