import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { NoopLeaseProvider } from '../../events/pubsub';
import { Mastra } from '../../mastra';
import type { WorkflowsStorage } from '../../storage';
import { InMemoryStore } from '../../storage/mock';
import { createWorkflow } from '../../workflows/create';
import { createStep } from '../../workflows/workflow';
import { EXECUTION_SUPERSEDED_ERROR_ID, ExecutionFence } from './execution-fence';

const empty = z.object({});

// A durable agent's workflow on the default engine takes no workflow claim (autoRestartActiveRuns:
// false) and runs inside the agent's execution fence. Nested runs it starts carry that fence: a
// nested workflow step runs under the agent's runId, a foreach item under its own, which the engine
// now reports to the fence the way the evented engine does. Once another execution takes the agent's
// run over, their writes are refused and the agent's execution is marked lost.
describe.each(['nested workflow', 'foreach nested workflow'] as const)(
  'a %s in a durable agent execution on the default engine',
  shape => {
    it('carries the execution fence, and a refused write marks the execution superseded', async () => {
      const storage = new InMemoryStore();
      const workflowsStore = (await storage.getStore('workflows')) as WorkflowsStorage;
      const ran: string[] = [];
      const { promise: stalled, resolve: release } = Promise.withResolvers<void>();
      const child = createWorkflow({ id: 'iteration', inputSchema: empty, outputSchema: empty })
        .then(
          createStep({
            id: 'c1',
            inputSchema: empty,
            outputSchema: empty,
            execute: async () => {
              ran.push('c1');
              await stalled;
              return {};
            },
          }),
        )
        .then(
          createStep({
            id: 'c2',
            inputSchema: empty,
            outputSchema: empty,
            execute: async () => {
              ran.push('c2');
              return {};
            },
          }),
        )
        .commit();
      const options = { autoRestartActiveRuns: false };
      const workflow =
        shape === 'nested workflow'
          ? createWorkflow({ id: 'agentic-loop', inputSchema: empty, outputSchema: z.any(), options })
              .then(child)
              .commit()
          : createWorkflow({ id: 'agentic-loop', inputSchema: z.array(empty), outputSchema: z.any(), options })
              .foreach(child)
              .commit();
      new Mastra({ logger: false, storage, workflows: { 'agentic-loop': workflow } });

      const runId = crypto.randomUUID();
      const fence = await ExecutionFence.claim({
        leaseProvider: NoopLeaseProvider,
        workflowsStore,
        agentId: 'agent',
        runId,
        mode: 'acquire',
      });
      const lost = vi.fn();
      fence.onLost(lost);
      const run = await workflow.createRun({ runId });
      const done = fence
        .run(() => run.start({ inputData: (shape === 'nested workflow' ? {} : [{}]) as any }))
        .catch((error: unknown) => error);
      await vi.waitFor(() => expect(ran).toEqual(['c1']));

      const childRunId = (await workflowsStore.listWorkflowRuns({ workflowName: 'iteration' })).runs[0]!.runId;
      expect(childRunId === runId).toBe(shape === 'nested workflow');
      expect(fence.fenceFor(workflowsStore, childRunId)).toEqual({
        runId,
        generation: fence.generation,
        ownerId: fence.executionId,
      });

      await workflowsStore.claimRunOwnership({ runId, ownerId: 'other-execution', leaseMs: 60_000, force: true });
      release();
      await done;

      expect(ran).toEqual(['c1']);
      expect(lost).toHaveBeenCalledWith(expect.objectContaining({ id: EXECUTION_SUPERSEDED_ERROR_ID }));
      const stored = await workflowsStore.loadWorkflowSnapshot({ workflowName: 'iteration', runId: childRunId });
      expect(stored?.context?.c1?.status).not.toBe('success');
    });
  },
);
