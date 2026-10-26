import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import type { WorkflowRunState } from '../../../workflows';
import { Agent } from '../../agent';
import { createDurableAgent } from '../index';
import { markRunActive } from '../run-registry';

function setup() {
  const storage = new InMemoryStore();
  const agent = createDurableAgent({
    agent: new Agent({ id: 'liveness-agent', name: 'Liveness', instructions: 'Wait.', model: 'openai/gpt-4o-mini' }),
  });
  const mastra = new Mastra({ agents: { agent }, storage, logger: false });
  const workflows = storage.stores.workflows!;
  const snapshot = async (status: 'running' | 'suspended', workflowName = 'durable-agentic-loop') => {
    const ownership = await workflows.getRunOwnership({ runId: 'run' });
    await workflows.persistWorkflowSnapshot({
      workflowName,
      runId: 'run',
      snapshot: {
        runId: 'run',
        status,
        value: {},
        requestContext: ownership
          ? { mastra__durableExecutions: { run: { executionId: ownership.ownerId, generation: ownership.generation } } }
          : undefined,
        context: { input: { agentId: agent.id, __workflowKind: 'durable-agent' } },
        serializedStepGraph: [],
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        timestamp: Date.now(),
      } satisfies WorkflowRunState,
    });
  };
  return { agent, mastra, workflows, snapshot };
}

describe('HTTP observation producer liveness (COR-1496)', () => {
  it('keeps a claimed silent producer alive and recognizes a released producer', async () => {
    const { agent, mastra, workflows, snapshot } = setup();
    try {
      await snapshot('running');
      const claim = await workflows.claimRunOwnership({ runId: 'run', ownerId: 'worker', leaseMs: 60_000 });
      expect(claim.acquired).toBe(true);
      expect(await agent.__getRunLiveness('run')).toMatchObject({ status: 'alive' });
      await workflows.releaseRunOwnership({ runId: 'run', ownerId: 'worker', generation: claim.record!.generation });
      expect(await agent.__getRunLiveness('run')).toEqual({ status: 'inactive', generation: claim.record!.generation });
    } finally {
      await mastra.shutdown();
    }
  });

  it('retains a suspended approval wait after its producer releases ownership', async () => {
    const { agent, mastra, workflows, snapshot } = setup();
    try {
      const claim = await workflows.claimRunOwnership({ runId: 'run', ownerId: 'worker', leaseMs: 60_000 });
      await workflows.releaseRunOwnership({ runId: 'run', ownerId: 'worker', generation: claim.record!.generation });
      await snapshot('suspended');
      expect(await agent.__getRunLiveness('run')).toMatchObject({ status: 'alive' });
    } finally {
      await mastra.shutdown();
    }
  });

  it('recognizes authoritative ownership absence for an associated run', async () => {
    const { agent, mastra, snapshot } = setup();
    try {
      await snapshot('running');
      expect(await agent.__getRunLiveness('run')).toMatchObject({ status: 'inactive' });
    } finally {
      await mastra.shutdown();
    }
  });

  it('finds suspended and abandoned runs under the advertised workflow name', async () => {
    const { agent, mastra, snapshot } = setup();
    Object.defineProperty(agent, 'durableLoopWorkflowName', { value: 'custom:durable-loop' });
    try {
      await snapshot('suspended', 'custom:durable-loop');
      expect(await agent.__getRunLiveness('run')).toMatchObject({ status: 'alive' });
      await snapshot('running', 'custom:durable-loop');
      expect(await agent.__getRunLiveness('run')).toMatchObject({ status: 'inactive' });
    } finally {
      await mastra.shutdown();
    }
  });

  it('does not retain an old suspended segment after a newer producer dies', async () => {
    const { agent, mastra, workflows, snapshot } = setup();
    try {
      const old = await workflows.claimRunOwnership({ runId: 'run', ownerId: 'old', leaseMs: 60_000 });
      await snapshot('suspended');
      await workflows.releaseRunOwnership({ runId: 'run', ownerId: 'old', generation: old.record!.generation });
      const current = await workflows.claimRunOwnership({ runId: 'run', ownerId: 'new', leaseMs: 60_000 });
      await workflows.releaseRunOwnership({ runId: 'run', ownerId: 'new', generation: current.record!.generation });
      expect(await agent.__getRunLiveness('run')).toMatchObject({
        status: 'inactive',
        generation: current.record!.generation,
      });
    } finally {
      await mastra.shutdown();
    }
  });

  it('does not classify an unassociated snapshot as an abandoned agent run', async () => {
    const { agent, mastra, workflows, snapshot } = setup();
    try {
      await snapshot('running');
      const record = await workflows.getWorkflowRunById({ workflowName: 'durable-agentic-loop', runId: 'run' });
      const state = record!.snapshot as WorkflowRunState;
      await workflows.persistWorkflowSnapshot({
        workflowName: 'durable-agentic-loop',
        runId: 'run',
        snapshot: { ...state, context: {} },
      });
      expect(await agent.__getRunLiveness('run')).toMatchObject({ status: 'unknown' });
    } finally {
      await mastra.shutdown();
    }
  });

  it('retains an observer when a replacement producer claims ownership during the probe', async () => {
    const { agent, mastra, workflows, snapshot } = setup();
    try {
      await snapshot('running');
      const read = workflows.getWorkflowRunById.bind(workflows);
      vi.spyOn(workflows, 'getWorkflowRunById').mockImplementationOnce(async input => {
        const record = await read(input);
        await workflows.claimRunOwnership({ runId: 'run', ownerId: 'replacement', leaseMs: 60_000 });
        return record;
      });
      expect(await agent.__getRunLiveness('run')).toMatchObject({ status: 'alive' });
    } finally {
      await mastra.shutdown();
    }
  });

  it('does not turn unavailable ownership or missing run evidence into death', async () => {
    const { agent, mastra, workflows } = setup();
    try {
      expect(await agent.__getRunLiveness('run')).toMatchObject({ status: 'unknown' });
      vi.spyOn(workflows, 'getRunOwnership').mockRejectedValue(new Error('storage offline'));
      expect(await agent.__getRunLiveness('run')).toMatchObject({ status: 'unknown' });
    } finally {
      await mastra.shutdown();
    }
  });

  it('does not attribute another Mastra instance’s unscoped active operation to this producer', async () => {
    const old = setup();
    const current = setup();
    const release = markRunActive('run');
    try {
      await current.snapshot('running');
      const claim = await current.workflows.claimRunOwnership({ runId: 'run', ownerId: 'gone', leaseMs: 60_000 });
      await current.workflows.releaseRunOwnership({
        runId: 'run',
        ownerId: 'gone',
        generation: claim.record!.generation,
      });
      expect(await current.agent.__getRunLiveness('run')).toMatchObject({ status: 'unknown' });
    } finally {
      release();
      await old.mastra.shutdown();
      await current.mastra.shutdown();
    }
  });
});
