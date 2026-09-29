/**
 * The output stream processor span lasts for the whole stream, so its duration
 * is dominated by the model's inter-chunk latency. `hookDurationMs` is the
 * processor's own share of that window: the time spent inside
 * `processOutputStream`, summed across chunks. These drive the clock so the
 * value is exact rather than "at least the sleep".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripWire } from '../agent/trip-wire';
import { OUTPUT_STREAM_HOOK_DURATION_KEY_PREFIX, ProcessorRunner, ProcessorState } from './runner';
import type { Processor } from './index';

const mockLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  trackException: () => {},
} as any;

/** Fake clock: `performance.now()` returns `clock`; the hook advances it. */
function installClock() {
  let clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  return { advance: (ms: number) => void (clock += ms) };
}

function createTracingContext() {
  const spans: Array<{ end: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> }> = [];
  const createChildSpan = vi.fn(() => {
    const span = { end: vi.fn(), error: vi.fn(), createChildSpan: vi.fn() };
    spans.push(span);
    return span;
  });
  return { tracingContext: { currentSpan: { findParent: vi.fn(), createChildSpan } } as any, spans };
}

function createRunner(outputProcessors: Processor[]) {
  return new ProcessorRunner({ inputProcessors: [], outputProcessors, logger: mockLogger, agentName: 'test-agent' });
}

const textDelta = (text: string) => ({ type: 'text-delta', payload: { text, id: 'text-1' } }) as any;
const finish = { type: 'finish', payload: {} } as any;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('output stream processor hookDurationMs', () => {
  it('sums the time spent inside processOutputStream across chunks, per processor', async () => {
    const clock = installClock();
    const slow: Processor = {
      id: 'slow',
      processOutputStream: async ({ part }) => {
        clock.advance(7);
        return part;
      },
    };
    const fast: Processor = { id: 'fast', processOutputStream: async ({ part }) => part };
    const runner = createRunner([slow, fast]);
    const { tracingContext, spans } = createTracingContext();
    const processorStates = new Map<string, ProcessorState>();

    await runner.processPart(textDelta('a'), processorStates, { tracingContext });
    await runner.processPart(textDelta('b'), processorStates, { tracingContext });
    await runner.processPart(finish, processorStates, { tracingContext });

    const [slowSpan, fastSpan] = spans;
    expect(slowSpan!.end).toHaveBeenCalledWith(
      expect.objectContaining({ attributes: { hookDurationMs: 21 }, output: expect.anything() }),
    );
    // Same stream window, no time of its own: the two are now distinguishable.
    expect(fastSpan!.end).toHaveBeenCalledWith(expect.objectContaining({ attributes: { hookDurationMs: 0 } }));
  });

  it('keeps the partial sum on a tripwire abort', async () => {
    const clock = installClock();
    const processor: Processor = {
      id: 'guard',
      processOutputStream: async ({ part, abort }) => {
        clock.advance(5);
        if (part.type === 'text-delta' && part.payload.text === 'b') abort('blocked');
        return part;
      },
    };
    const runner = createRunner([processor]);
    const { tracingContext, spans } = createTracingContext();
    const processorStates = new Map<string, ProcessorState>();

    await runner.processPart(textDelta('a'), processorStates, { tracingContext });
    const result = await runner.processPart(textDelta('b'), processorStates, { tracingContext });

    expect(result.blocked).toBe(true);
    expect(spans[0]!.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(TripWire),
        endSpan: true,
        attributes: expect.objectContaining({ hookDurationMs: 10, tripwireAbort: expect.anything() }),
      }),
    );
  });

  it('keeps the partial sum when the hook throws', async () => {
    const clock = installClock();
    const processor: Processor = {
      id: 'broken',
      processOutputStream: async () => {
        clock.advance(3);
        throw new Error('boom');
      },
    };
    const runner = createRunner([processor]);
    const { tracingContext, spans } = createTracingContext();
    const processorStates = new Map<string, ProcessorState>();

    await runner.processPart(textDelta('a'), processorStates, { tracingContext });

    expect(spans[0]!.error).toHaveBeenCalledWith(
      expect.objectContaining({ endSpan: true, attributes: { hookDurationMs: 3 } }),
    );
  });

  it('attaches the sum on teardown, for legacy and workflow processor spans alike', async () => {
    const clock = installClock();
    const processor: Processor = {
      id: 'legacy',
      processOutputStream: async ({ part }) => {
        clock.advance(4);
        return part;
      },
    };
    const runner = createRunner([processor]);
    const { tracingContext, spans } = createTracingContext();
    const processorStates = new Map<string, ProcessorState>();

    await runner.processPart(textDelta('a'), processorStates, { tracingContext });

    const workflowEnd = vi.fn();
    const workflowState = new ProcessorState();
    workflowState.customState.__outputStreamSpan_workflow = { end: workflowEnd };
    workflowState.customState[`${OUTPUT_STREAM_HOOK_DURATION_KEY_PREFIX}workflow`] = 12;
    processorStates.set('workflow', workflowState);

    runner.endStreamProcessorSpans(processorStates);

    expect(spans[0]!.end).toHaveBeenCalledWith(expect.objectContaining({ attributes: { hookDurationMs: 4 } }));
    expect(workflowEnd).toHaveBeenCalledWith({ attributes: { hookDurationMs: 12 } });
    // The bookkeeping key must not outlive the span it belongs to.
    expect(workflowState.customState).toEqual({});
  });
});
