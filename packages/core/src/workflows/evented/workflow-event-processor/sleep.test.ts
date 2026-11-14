import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PubSub } from '../../../events';
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

const cases = [
  {
    name: 'sleep for 30 days',
    run: (pubsub: PubSub) =>
      processWorkflowSleep(args, {
        pubsub,
        stepExecutor: new StepExecutor({}),
        step: { type: 'sleep', id: 'nap', duration: thirtyDays } as Extract<StepFlowEntry, { type: 'sleep' }>,
      }),
  },
  {
    name: 'sleepUntil a date 30 days ahead',
    run: (pubsub: PubSub) =>
      processWorkflowSleepUntil(args, {
        pubsub,
        stepExecutor: new StepExecutor({}),
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
  it.each(cases)('$name publishes the next step only after 30 days', async ({ run }) => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const nextStepRuns = () => publish.mock.calls.filter(([topic]) => topic === 'workflows');

    await run({ publish } as unknown as PubSub);

    await vi.advanceTimersByTimeAsync(thirtyDays - 1);
    expect(nextStepRuns()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(nextStepRuns()).toHaveLength(1);
    expect(nextStepRuns()[0]![1]).toMatchObject({ type: 'workflow.step.run', data: { executionPath: [2] } });
  });
});
