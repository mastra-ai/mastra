import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { WorkflowRuns } from '../storage';
import { MockStore } from '../storage/mock';
import { createEmptyWorkflowSnapshot } from '../storage/workflow-snapshot';
import { Agent } from '../agent';
import { createDurableAgent } from '../agent/durable/create-durable-agent';
import { createWorkflow } from '../workflows';
import type { WorkflowRunStatus } from '../workflows';
import { Mastra } from './index';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

function createWorkflowRun(
  workflowName: string,
  runId: string,
  status: WorkflowRunStatus,
): WorkflowRuns['runs'][number] {
  return {
    workflowName,
    runId,
    snapshot: {
      ...createEmptyWorkflowSnapshot(runId),
      status,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeAgent(id: string) {
  return new Agent({
    id,
    name: id,
    instructions: 'x',
    model: 'openai/gpt-4o',
  });
}

describe('Mastra listActiveWorkflowRuns', () => {
  it('lists active workflow runs without serializing independent storage reads', async () => {
    const firstWorkflow = createWorkflow({
      id: 'active-first',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    }).commit();
    const secondWorkflow = createWorkflow({
      id: 'active-second',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    }).commit();

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { firstWorkflow, secondWorkflow },
    });

    const calls: string[] = [];
    const deferreds: Array<Deferred<WorkflowRuns>> = [];

    for (const workflow of [firstWorkflow, secondWorkflow]) {
      vi.spyOn(workflow, 'listWorkflowRuns').mockImplementation(args => {
        calls.push(`${workflow.id}:${args?.status}`);
        const deferred = createDeferred<WorkflowRuns>();
        deferreds.push(deferred);
        return deferred.promise;
      });
    }

    const activeRunsPromise = mastra.listActiveWorkflowRuns();
    await Promise.resolve();

    expect(calls).toEqual([
      'active-first:running',
      'active-first:waiting',
      'active-second:running',
      'active-second:waiting',
    ]);

    const firstRunning = {
      runs: [createWorkflowRun('active-first', 'first-running', 'running')],
      total: 1,
    };
    const firstWaiting = {
      runs: [createWorkflowRun('active-first', 'first-waiting', 'waiting')],
      total: 1,
    };
    const secondRunning = {
      runs: [createWorkflowRun('active-second', 'second-running', 'running')],
      total: 1,
    };
    const secondWaiting = {
      runs: [createWorkflowRun('active-second', 'second-waiting', 'waiting')],
      total: 1,
    };

    const getDeferred = (index: number) => {
      const deferred = deferreds[index];
      if (!deferred) {
        throw new Error(`Expected deferred call at index ${index}`);
      }
      return deferred;
    };

    getDeferred(0).resolve(firstRunning);
    getDeferred(1).resolve(firstWaiting);
    getDeferred(2).resolve(secondRunning);
    getDeferred(3).resolve(secondWaiting);

    await expect(activeRunsPromise).resolves.toEqual({
      runs: [...firstRunning.runs, ...firstWaiting.runs, ...secondRunning.runs, ...secondWaiting.runs],
      total: 4,
    });
  });

  it('skips durable-agent-owned workflows during generic boot recovery discovery', async () => {
    const firstDurableAgent = createDurableAgent({ agent: makeAgent('durable-agent-a') });
    const secondDurableAgent = createDurableAgent({ agent: makeAgent('durable-agent-b') });
    const firstDurableWorkflow = firstDurableAgent.getWorkflow();
    const secondDurableWorkflow = secondDurableAgent.getWorkflow();
    const firstDurableSpy = vi.spyOn(firstDurableWorkflow, 'listWorkflowRuns').mockImplementation(() => {
      throw new Error('durable-agent-owned workflows must not be enumerated by generic recovery');
    });
    const secondDurableSpy = vi.spyOn(secondDurableWorkflow, 'listWorkflowRuns').mockImplementation(() => {
      throw new Error('durable-agent-owned workflows must not be enumerated by generic recovery');
    });

    const plainWorkflow = createWorkflow({
      id: 'plain-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    }).commit();
    vi.spyOn(plainWorkflow, 'listWorkflowRuns').mockImplementation(({ status }) => {
      if (status === 'running') {
        return Promise.resolve({
          runs: [createWorkflowRun('plain-workflow', 'plain-running', 'running')],
          total: 1,
        });
      }

      return Promise.resolve({ runs: [], total: 0 });
    });

    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      agents: {
        durableA: firstDurableAgent as any,
        durableB: secondDurableAgent as any,
      },
      workflows: { plainWorkflow } as any,
    });

    await expect(mastra.listActiveWorkflowRuns()).resolves.toEqual({
      runs: [createWorkflowRun('plain-workflow', 'plain-running', 'running')],
      total: 1,
    });

    expect(firstDurableSpy).not.toHaveBeenCalled();
    expect(secondDurableSpy).not.toHaveBeenCalled();
  });
});
