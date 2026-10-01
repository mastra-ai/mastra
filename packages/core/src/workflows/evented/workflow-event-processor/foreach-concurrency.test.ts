import { describe, expect, it } from 'vitest';
import { processWorkflowForEach } from './loop';

/**
 * Regression coverage for execution-time foreach concurrency resolution in the
 * evented engine.
 *
 * `opts.concurrency` may be a resolver function instead of a static number
 * (used by durable agents to derive tool-call concurrency from serialized run
 * state). The evented processor must invoke the resolver when kicking off the
 * initial iteration batch — with the foreach input and the run's init data —
 * rather than treating the function as a missing static value (which would
 * silently serialize every iteration).
 */

function makeForeachStep(concurrency: number | ((ctx: { inputData: unknown; getInitData: () => unknown }) => number)) {
  return {
    type: 'foreach' as const,
    step: { id: 'body' },
    opts: { concurrency },
  } as any;
}

async function kickOffForeach({
  concurrency,
  items,
  initData,
  currentOutput,
  currentSuspendPayload,
}: {
  concurrency: number | ((ctx: { inputData: unknown; getInitData: () => unknown }) => number);
  items: unknown[];
  initData?: unknown;
  currentOutput?: unknown[];
  currentSuspendPayload?: unknown;
}) {
  const published: any[] = [];
  const pubsub = {
    publish: async (_topic: string, event: any) => {
      published.push(event);
    },
  } as any;
  const mastra = { getStorage: () => undefined } as any;

  await processWorkflowForEach(
    {
      workflowId: 'wf',
      runId: 'run-1',
      executionPath: [0],
      stepResults: {
        ...(initData === undefined ? {} : { input: initData }),
        ...(currentOutput === undefined
          ? {}
          : {
              body: {
                status: 'success',
                output: currentOutput,
                startedAt: 1,
                payload: items,
                suspendPayload: currentSuspendPayload,
              },
            }),
      } as any,
      activeStepsPath: {},
      resumeSteps: [],
      prevResult: { status: 'success', output: items, startedAt: 1, endedAt: 2, payload: {} },
      requestContext: {},
    } as any,
    { pubsub, mastra, step: makeForeachStep(concurrency) },
  );

  return published;
}

describe('processWorkflowForEach concurrency resolution', () => {
  it('kicks off the initial batch using a resolver function', async () => {
    const resolverCalls: { inputData: unknown; initData: unknown }[] = [];
    const items = [1, 2, 3, 4, 5];
    const initData = { options: { toolCallConcurrency: 3 } };

    const runEvents = await kickOffForeach({
      concurrency: ctx => {
        resolverCalls.push({ inputData: ctx.inputData, initData: ctx.getInitData() });
        return 3;
      },
      items,
      initData,
    });

    // Resolver decides the initial batch size at execution time.
    expect(runEvents).toHaveLength(3);
    expect(runEvents.map(e => e.data.executionPath)).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
    // Resolver sees the foreach input and the run's init data.
    expect(resolverCalls).toEqual([{ inputData: items, initData }]);
  });

  it('still supports static concurrency numbers', async () => {
    const runEvents = await kickOffForeach({ concurrency: 2, items: [1, 2, 3] });
    expect(runEvents).toHaveLength(2);
  });

  it('falls back to sequential kick-off when the resolver returns an invalid value', async () => {
    const runEvents = await kickOffForeach({ concurrency: () => -5, items: [1, 2, 3] });
    expect(runEvents).toHaveLength(1);
  });

  it('suspends instead of replacing an iteration that still occupies its concurrency slot', async () => {
    const events = await kickOffForeach({
      concurrency: 1,
      items: [1, 2],
      currentOutput: [{ status: 'suspended', suspendPayload: { approval: true } }],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'workflow.step.end',
      data: { prevResult: { status: 'suspended' } },
    });
  });

  it('preserves foreach output metadata when all active iterations are suspended', async () => {
    const foreachOutput = [
      { status: 'success', output: 'first' },
      { status: 'suspended', suspendPayload: { approval: true } },
    ];
    const events = await kickOffForeach({
      concurrency: 1,
      items: [1, 2, 3],
      currentOutput: [
        { status: 'success', output: 'first' },
        { status: 'suspended', suspendPayload: { approval: true } },
      ],
      currentSuspendPayload: { __workflow_meta: { foreachOutput } },
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'workflow.step.end',
      data: {
        prevResult: {
          status: 'suspended',
          suspendPayload: { __workflow_meta: { foreachIndex: 1, foreachOutput } },
        },
      },
    });
  });

  it('starts the next iteration after a concurrency slot completes', async () => {
    const events = await kickOffForeach({
      concurrency: 1,
      items: [1, 2],
      currentOutput: [{ status: 'success', output: 'first' }],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'workflow.step.run',
      data: { executionPath: [0, 1] },
    });
  });

  it('fills a free slot while another iteration remains suspended', async () => {
    const events = await kickOffForeach({
      concurrency: 2,
      items: [1, 2, 3],
      currentOutput: [
        { status: 'suspended', suspendPayload: { approval: true } },
        { status: 'success', output: 'second' },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'workflow.step.run',
      data: { executionPath: [0, 2] },
    });
  });
});
