import { describe, expect, it } from 'vitest';
import type { WorkflowRunState } from '../../../workflows';
import { InMemoryStore } from '../../mock';

// PF-4385 tombstone reopen: a delayed result write from a deleted execution
// lifetime must not merge into the snapshot a reopened lifetime installed
// under the same runId. updateWorkflowResults fences the caller-supplied
// executionGeneration against the stored snapshot before any merge; a write
// that carries no generation keeps the legacy unguarded behavior.
const makeSnapshot = (runId: string, executionGeneration?: string): WorkflowRunState =>
  ({
    runId,
    status: 'running',
    value: {},
    context: {},
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    serializedStepGraph: [],
    waitingPaths: {},
    timestamp: Date.now(),
    ...(executionGeneration === undefined ? {} : { executionGeneration }),
  }) as WorkflowRunState;

const result = (output: unknown) =>
  ({
    status: 'success',
    output,
    payload: {},
    startedAt: 1,
    endedAt: 2,
  }) as any;

describe('WorkflowsInMemory updateWorkflowResults executionGeneration fence', () => {
  it('merges a result write carrying the snapshot execution generation', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'wf';
    const runId = 'run-matching';
    await workflows.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot: makeSnapshot(runId, 'wfeg:lifetime-b'),
    });

    await expect(
      workflows.updateWorkflowResults({
        workflowName,
        runId,
        stepId: 'step-1',
        result: result({ data: 'fresh' }),
        requestContext: {},
        executionGeneration: 'wfeg:lifetime-b',
      }),
    ).resolves.toEqual({
      'step-1': expect.objectContaining({ status: 'success', output: { data: 'fresh' } }),
    });
  });

  it('fences a stale-lifetime write without merging into the reopened snapshot', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'wf';
    const runId = 'run-reopened';
    // Lifetime B reopened the runId after lifetime A was deleted; a delayed
    // result write still carrying A's generation must no-op.
    await workflows.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot: makeSnapshot(runId, 'wfeg:lifetime-b'),
    });

    await expect(
      workflows.updateWorkflowResults({
        workflowName,
        runId,
        stepId: 'step-1',
        result: result({ data: 'stale' }),
        requestContext: {},
        executionGeneration: 'wfeg:lifetime-a',
      }),
    ).resolves.toEqual({});

    await expect(workflows.loadWorkflowSnapshot({ workflowName, runId })).resolves.toMatchObject({
      executionGeneration: 'wfeg:lifetime-b',
      context: {},
    });
  });

  it('fences a generation-carrying write against a snapshot with no stored lineage', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'wf';
    const runId = 'run-unversioned';
    await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: makeSnapshot(runId) });

    await expect(
      workflows.updateWorkflowResults({
        workflowName,
        runId,
        stepId: 'step-1',
        result: result({ data: 'stale' }),
        requestContext: {},
        executionGeneration: 'wfeg:lifetime-a',
      }),
    ).resolves.toEqual({});
    await expect(workflows.loadWorkflowSnapshot({ workflowName, runId })).resolves.toMatchObject({
      context: {},
    });
  });

  it('keeps unguarded merges for writes that carry no execution generation', async () => {
    const store = new InMemoryStore();
    const workflows = (await store.getStore('workflows'))!;
    const workflowName = 'wf';
    for (const [runId, generation] of [
      ['run-legacy-generated', 'wfeg:lifetime-b'],
      ['run-legacy-plain', undefined],
    ] as const) {
      await workflows.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: makeSnapshot(runId, generation),
      });
      await expect(
        workflows.updateWorkflowResults({
          workflowName,
          runId,
          stepId: 'step-1',
          result: result({ data: 'legacy' }),
          requestContext: {},
        }),
      ).resolves.toEqual({
        'step-1': expect.objectContaining({ status: 'success', output: { data: 'legacy' } }),
      });
    }
  });
});
