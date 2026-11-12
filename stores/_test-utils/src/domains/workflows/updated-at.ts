import { randomUUID } from 'node:crypto';
import type { WorkflowsStorage } from '@mastra/core/storage';
import type { WorkflowRunStatus } from '@mastra/core/workflows';
import { describe, expect, it } from 'vitest';
import { createSampleWorkflowSnapshot } from './data';

type UpdateMethod = 'updateWorkflowResults' | 'updateWorkflowState' | 'updateWorkflowRunHeader';

// Every adapter keeps updatedAt to the millisecond or finer.
const waitPastUpdatedAt = () => new Promise(resolve => setTimeout(resolve, 50));

/**
 * Whether `error` is the store saying it doesn't implement `method` at all: `<method> is not
 * implemented for ...` (D1, ClickHouse, LanceDB) or `Method not implemented.` (Durable Objects).
 */
function isNotImplemented(method: UpdateMethod, error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith(`${method} is not implemented`) || message === 'Method not implemented.';
}

/**
 * Conformance cases for `updatedAt` on partial run writes. Run recovery waits out a grace period
 * from a run's last `updatedAt` before restarting it, so every write an engine makes between
 * steps must count as activity, not only a full re-persist, while a write a status guard
 * rejected must not.
 */
export function createUpdatedAtTests({ getStore }: { getStore: () => WorkflowsStorage }) {
  describe('updatedAt on partial run writes', () => {
    const workflowName = `wf-updated-at-${randomUUID()}`;

    it.for(['updateWorkflowResults', 'updateWorkflowState'] as const)(
      'advances updatedAt on %s',
      async (method, { skip }) => {
        const store = getStore();
        const { snapshot, runId } = createSampleWorkflowSnapshot('running');
        await store.persistWorkflowSnapshot({ workflowName, runId, snapshot });
        const updatedAt = async () =>
          new Date((await store.getWorkflowRunById({ runId, workflowName }))!.updatedAt).getTime();
        const before = await updatedAt();
        await waitPastUpdatedAt();

        try {
          if (method === 'updateWorkflowResults') {
            await store.updateWorkflowResults({
              workflowName,
              runId,
              stepId: 'later-step',
              result: { status: 'success', output: {}, payload: {}, startedAt: Date.now(), endedAt: Date.now() } as any,
              requestContext: {},
            });
          } else {
            await store.updateWorkflowState({ workflowName, runId, opts: { status: 'running' } });
          }
        } catch (error) {
          if (isNotImplemented(method, error)) {
            return skip();
          }

          throw error;
        }

        expect(await updatedAt()).toBeGreaterThan(before);
      },
    );

    it.for(['updateWorkflowRunHeader', 'updateWorkflowState'] as const)(
      'advances updatedAt on a storage v2 %s, and leaves it when the status guard rejects the patch',
      async (method, { skip }) => {
        const store = getStore();
        if (!store.supportsRunJournal()) {
          return skip();
        }

        const { snapshot, runId } = createSampleWorkflowSnapshot('running');
        const { context, value: _value, ...header } = snapshot;
        await store.writeWorkflowRunCheckpoint({ workflowName, runId, header, steps: context });
        const updatedAt = async () => (await store.getWorkflowRunById({ workflowName, runId }))!.updatedAt.getTime();
        const patch = (opts: { status: WorkflowRunStatus; expectedStatus: WorkflowRunStatus }) =>
          method === 'updateWorkflowRunHeader'
            ? store.updateWorkflowRunHeader({ workflowName, runId, opts })
            : store.updateWorkflowState({ workflowName, runId, opts });
        const written = await updatedAt();
        await waitPastUpdatedAt();

        expect(await patch({ status: 'canceled', expectedStatus: 'suspended' })).toBeUndefined();
        expect(await updatedAt()).toBe(written);

        expect(await patch({ status: 'canceled', expectedStatus: 'running' })).toBeDefined();
        expect(await updatedAt()).toBeGreaterThan(written);
      },
    );
  });
}
