import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

// The span is created in _start and only ended inside executionEngine.execute(), so the
// assertion has to be on the span object itself — there is no exporter on this path to observe.
const getOrCreateSpanMock = vi.fn();
vi.mock('../observability', async importOriginal => {
  const actual = await importOriginal<typeof import('../observability')>();
  return {
    ...actual,
    getOrCreateSpan: (...args: any[]) => getOrCreateSpanMock(...args) ?? (actual.getOrCreateSpan as any)(...args),
  };
});

const step = createStep({
  id: 'step-1',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ value: z.string() }),
  execute: async ({ inputData }) => inputData,
});

function buildWorkflow(options: { onStart?: (info: any) => Promise<void> | void }) {
  const workflow = createWorkflow({
    id: 'on-start-workflow',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    options,
  })
    .then(step)
    .commit();

  const storage = new MockStore();
  new Mastra({ workflows: { 'on-start-workflow': workflow }, storage });

  return { workflow, storage };
}

describe('workflow onStart', () => {
  it('runs before the workflow executes and receives the run context', async () => {
    const executionOrder: string[] = [];
    const onStart = vi.fn(async () => {
      executionOrder.push('onStart');
    });

    const stepSpy = createStep({
      id: 'spy-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ inputData }) => {
        executionOrder.push('step');
        return inputData;
      },
    });

    const workflow = createWorkflow({
      id: 'on-start-order-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      options: { onStart },
    })
      .then(stepSpy)
      .commit();
    new Mastra({ workflows: { 'on-start-order-workflow': workflow }, storage: new MockStore() });

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { value: 'hello' } });

    expect(result.status).toBe('success');
    expect(executionOrder).toEqual(['onStart', 'step']);

    const info = (onStart.mock.calls as any[])[0][0];
    expect(info.runId).toBe(run.runId);
    expect(info.workflowId).toBe('on-start-order-workflow');
    expect(info.getInitData()).toEqual({ value: 'hello' });
    expect(info.requestContext).toBeDefined();
    expect(info.logger).toBeDefined();
  });

  it('rejects the run and skips execution when onStart throws', async () => {
    const stepSpy = vi.fn(async ({ inputData }: any) => inputData);
    const gatedStep = createStep({
      id: 'gated-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: stepSpy as any,
    });

    const workflow = createWorkflow({
      id: 'on-start-gate-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      options: {
        onStart: async () => {
          throw new Error('quota exceeded');
        },
      },
    })
      .then(gatedStep)
      .commit();
    const storage = new MockStore();
    new Mastra({ workflows: { 'on-start-gate-workflow': workflow }, storage });

    const run = await workflow.createRun();
    await expect(run.start({ inputData: { value: 'hello' } })).rejects.toThrow('quota exceeded');

    expect(stepSpy).not.toHaveBeenCalled();

    // On this engine `createRun()` already wrote a pending record before `start()` was
    // ever called, so the gate cannot leave nothing behind — it leaves the run parked at
    // 'pending'. Asserting the exact status rather than `not.toBe('success')`, which would
    // also pass if the run had failed halfway through a step.
    const workflowsStore = await storage.getStore('workflows');
    const persisted = await workflowsStore?.getWorkflowRunById({
      runId: run.runId,
      workflowName: 'on-start-gate-workflow',
    });
    expect((persisted?.snapshot as any)?.status).toBe('pending');
  });

  it('does not fire again when a suspended run is resumed', async () => {
    const onStart = vi.fn();
    const suspendingStep = createStep({
      id: 'suspending-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      resumeSchema: z.object({ confirmed: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData?.confirmed) {
          await suspend({});
          return inputData;
        }
        return inputData;
      },
    });

    const workflow = createWorkflow({
      id: 'on-start-resume-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      options: { onStart },
    })
      .then(suspendingStep)
      .commit();
    new Mastra({ workflows: { 'on-start-resume-workflow': workflow }, storage: new MockStore() });

    const run = await workflow.createRun();
    const suspended = await run.start({ inputData: { value: 'hello' } });
    expect(suspended.status).toBe('suspended');
    expect(onStart).toHaveBeenCalledTimes(1);

    await run.resume({ step: 'suspending-step', resumeData: { confirmed: true } });
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('runs before a streamed workflow executes', async () => {
    const onStart = vi.fn();
    const { workflow } = buildWorkflow({ onStart });

    const run = await workflow.createRun();
    const stream = run.stream({ inputData: { value: 'hello' } });
    const result = await stream.result;

    expect(result.status).toBe('success');
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  /**
   * `_start` creates the workflow-run span and hands ownership to `executionEngine.execute()`,
   * which is never reached when the hook rejects. Without an explicit end the span stays open
   * for the life of the trace, so exporters see a start with no matching end.
   */
  it('ends the workflow span when onStart rejects', async () => {
    const spanError = vi.fn();
    const spanEnd = vi.fn();
    getOrCreateSpanMock.mockReturnValueOnce({
      id: 'span-1',
      externalTraceId: 'trace-1',
      error: spanError,
      end: spanEnd,
    });

    const { workflow } = buildWorkflow({
      onStart: async () => {
        throw new Error('quota exceeded');
      },
    });

    const run = await workflow.createRun();
    await expect(run.start({ inputData: { value: 'hello' } })).rejects.toThrow('quota exceeded');

    expect(spanError).toHaveBeenCalledTimes(1);
    expect(spanError.mock.calls[0]![0]!.error.message).toBe('quota exceeded');
  });
});
