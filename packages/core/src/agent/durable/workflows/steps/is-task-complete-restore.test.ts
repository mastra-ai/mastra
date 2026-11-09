import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../../../message-list';
import { globalRunRegistry } from '../../run-registry';
import { createDurableIsTaskCompleteStep } from './is-task-complete';

const runId = 'worker-completion-run';

function scorer(id: string, run = vi.fn(async () => ({ score: 1 }))) {
  return { id, name: 'Confirmed commitment', run } as any;
}

function runStep({
  getDefaultOptions,
  registry,
}: {
  getDefaultOptions: () => unknown;
  registry?: Record<string, unknown>;
}) {
  if (registry) globalRunRegistry.set(runId, registry as any);
  const warn = vi.fn();
  const mastra = {
    getAgentById: () => ({ getDefaultOptions }),
    getLogger: () => ({ warn, debug: vi.fn(), error: vi.fn(), info: vi.fn() }),
    generateId: () => crypto.randomUUID(),
  } as any;
  const state = {
    runId,
    iterationCount: 1,
    messageListState: new MessageList().serialize(),
    accumulatedSteps: [{ text: 'DRAFT' }],
    lastStepResult: { isContinued: false, reason: 'stop' },
    options: { maxSteps: 3 },
  };
  const result = (createDurableIsTaskCompleteStep() as any).execute({
    inputData: state,
    mastra,
    getInitData: () => ({
      agentId: 'coach',
      agentName: 'Coach',
      state: {},
      options: {
        isTaskComplete: {
          fromAgentDefaults: true,
          scorerIds: ['confirmed-commitment'],
          scorerNames: ['Confirmed commitment'],
        },
      },
    }),
  });
  return { result, warn };
}

afterEach(() => {
  globalRunRegistry.delete(runId);
});

describe('durable isTaskComplete step on a process that did not prepare the run', () => {
  it('rebuilds the policy from the agent defaults and grades the step', async () => {
    const run = vi.fn(async () => ({ score: 0 }));
    const { result, warn } = runStep({
      getDefaultOptions: () => ({ isTaskComplete: { scorers: [scorer('confirmed-commitment', run)] } }),
    });

    const next = await result;
    expect(run).toHaveBeenCalledTimes(1);
    expect(next.lastStepResult.isContinued).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('caches the rebuilt policy on a registry entry the worker rebuilt', async () => {
    const entry: Record<string, unknown> = { tools: {} };
    const { result } = runStep({
      getDefaultOptions: () => ({ isTaskComplete: { scorers: [scorer('confirmed-commitment')] } }),
      registry: entry,
    });

    await result;
    expect((entry.isTaskComplete as any)?.scorers?.[0]?.id).toBe('confirmed-commitment');
  });

  it('warns instead of grading with a different scorer that shares the name', async () => {
    const run = vi.fn(async () => ({ score: 1 }));
    const { result, warn } = runStep({
      getDefaultOptions: () => ({ isTaskComplete: { scorers: [scorer('replacement-scorer', run)] } }),
    });

    const next = await result;
    expect(run).not.toHaveBeenCalled();
    expect(next.lastStepResult.isContinued).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Cannot restore isTaskComplete'));
  });

  it('warns instead of failing when the defaults throw', async () => {
    const { result, warn } = runStep({
      getDefaultOptions: () => {
        throw new Error('defaults unavailable');
      },
    });

    const next = await result;
    expect(next.lastStepResult.isContinued).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('defaults unavailable'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Cannot restore isTaskComplete'));
  });

  it('leaves a policy this process already decided alone', async () => {
    const getDefaultOptions = vi.fn();
    const { result } = runStep({ getDefaultOptions, registry: { isTaskComplete: undefined } });

    await result;
    expect(getDefaultOptions).not.toHaveBeenCalled();
  });
});
