import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PubSub } from '../../../events';
import type { IMastraLogger } from '../../../logger';
import { createRunStorage } from '../../run-storage';
import type { StepFlowEntry } from '../../types';
import type { Workflow } from '../../workflow';
import { StepExecutor } from '../step-executor';
import { processWorkflowSleep, processWorkflowSleepUntil } from './sleep';
import type { ProcessorArgs } from '.';

const thirtyDays = 30 * 24 * 60 * 60 * 1000;

const args = {
  workflow: { options: {} } as Workflow,
  workflowId: 'wf',
  runId: 'run-1',
  executionPath: [1],
  stepResults: {},
  activeStepsPath: {},
  resumeSteps: [],
  prevResult: { status: 'success', output: {} },
  requestContext: {},
} as unknown as ProcessorArgs;

const runStorage = createRunStorage({
  storageVersion: 2,
  workflowName: 'wf',
  runId: 'run-1',
  getStore: async () => undefined,
});

const cases = [
  {
    name: 'sleep for 30 days',
    run: (pubsub: PubSub, logger?: IMastraLogger) =>
      processWorkflowSleep(args, {
        pubsub,
        logger,
        stepExecutor: new StepExecutor({}),
        runStorage,
        step: { type: 'sleep', id: 'nap', duration: thirtyDays } as Extract<StepFlowEntry, { type: 'sleep' }>,
      }),
  },
  {
    name: 'sleepUntil a date 30 days ahead',
    run: (pubsub: PubSub, logger?: IMastraLogger) =>
      processWorkflowSleepUntil(args, {
        pubsub,
        logger,
        stepExecutor: new StepExecutor({}),
        runStorage,
        step: { type: 'sleepUntil', id: 'until', date: new Date(Date.now() + thirtyDays) } as Extract<
          StepFlowEntry,
          { type: 'sleepUntil' }
        >,
      }),
  },
];

describe('evented sleep longer than the largest timer delay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Node and Bun fire a `setTimeout` delay above 2^31-1 ms after 1 ms.
  it.each(cases)('$name ends only after 30 days', async ({ run }) => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const stepEnds = () => publish.mock.calls.filter(([topic]) => topic === 'workflows');

    await run({ publish } as unknown as PubSub);

    await vi.advanceTimersByTimeAsync(thirtyDays - 1);
    expect(stepEnds()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(stepEnds()).toHaveLength(1);
    expect(stepEnds()[0]![1]).toMatchObject({ type: 'workflow.step.end', data: { executionPath: [1] } });
  });

  it.each(cases)('$name logs a failed end publish instead of rejecting unhandled', async ({ run }) => {
    const error = new Error('broker down');
    const publish = vi.fn(async (topic: string) => {
      if (topic === 'workflows') throw error;
    });
    const logger = { error: vi.fn() } as unknown as IMastraLogger;
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      await run({ publish } as unknown as PubSub, logger);
      await vi.advanceTimersByTimeAsync(thirtyDays);
      vi.useRealTimers();
      await new Promise(resolve => setImmediate(resolve));
      expect(unhandled).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(expect.any(String), { runId: 'run-1', error });
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
