import { describe, expect, it, vi } from 'vitest';
import { SpanType } from '../observability';
import { ProcessorRunner, ProcessorState } from './runner';
import type { Processor } from './index';

const mockLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  trackException: () => {},
} as any;

describe('output stream processor span teardown', () => {
  it('ends legacy and workflow processor spans when the stream closes without a finish chunk', async () => {
    const legacyEnd = vi.fn();
    const workflowEnd = vi.fn();
    const createChildSpan = vi.fn(() => ({
      end: legacyEnd,
      error: vi.fn(),
      createChildSpan: vi.fn(),
    }));
    const tracingContext = {
      currentSpan: {
        findParent: vi.fn(),
        createChildSpan,
      },
    } as any;
    const processor: Processor = {
      id: 'stream-processor',
      processOutputStream: async ({ part }) => part,
    };
    const runner = new ProcessorRunner({
      inputProcessors: [],
      outputProcessors: [processor],
      logger: mockLogger,
      agentName: 'test-agent',
    });
    const processorStates = new Map<string, ProcessorState>();

    await runner.processPart(
      {
        type: 'tool-result',
        payload: { toolCallId: 'call-1', toolName: 'search', result: { hits: 1 } },
      } as any,
      processorStates,
      { tracingContext },
    );
    await runner.processPart(
      { type: 'text-delta', payload: { text: 'hello world', id: 'text-1' } } as any,
      processorStates,
      { tracingContext },
    );

    const workflowState = new ProcessorState();
    workflowState.customState.__outputStreamSpan_workflow = { end: workflowEnd };
    processorStates.set('workflow', workflowState);

    runner.endStreamProcessorSpans(processorStates);

    expect(legacyEnd).toHaveBeenCalledTimes(1);
    expect(legacyEnd).toHaveBeenCalledWith({
      output: { totalChunks: 2, accumulatedText: 'hello world' },
      attributes: { hookDurationMs: expect.any(Number) },
    });
    expect(workflowEnd).toHaveBeenCalledTimes(1);
  });

  it("keeps a step's workflow span open when only its model stream closed, and ends it on cancel", () => {
    const stepSpanEnd = vi.fn();
    const runSpanEnd = vi.fn();
    const state = new ProcessorState();
    state.customState.__outputStreamSpan_step = { end: stepSpanEnd, parent: { type: SpanType.MODEL_STEP } };
    state.customState.__outputStreamSpan_run = { end: runSpanEnd, parent: { type: SpanType.AGENT_RUN } };
    const processorStates = new Map([['processor', state]]);
    const runner = new ProcessorRunner({
      inputProcessors: [],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });

    // The step's tool results still go through the processors after its model stream ends
    runner.endStreamProcessorSpans(processorStates, { keepStepScopedSpans: true });
    expect(stepSpanEnd).not.toHaveBeenCalled();
    expect(state.customState.__outputStreamSpan_step).toBeDefined();
    expect(runSpanEnd).toHaveBeenCalledTimes(1);

    runner.endStreamProcessorSpans(processorStates);
    expect(stepSpanEnd).toHaveBeenCalledTimes(1);
    expect(state.customState.__outputStreamSpan_step).toBeUndefined();
  });
});
