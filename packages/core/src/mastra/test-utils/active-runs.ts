/** Helpers for the recovery tests that store active runs by hand (#28712). */
import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import type { MastraStorage } from '../../storage';
import { createEmptyWorkflowSnapshot } from '../../storage/workflow-snapshot';
import type { WorkflowRunStatus } from '../../workflows';

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Stores a run of `workflowName` its process left `status` mid-run, as a crash leaves it. `updatedAt`
 * backdates its last write, so a test needs no wait for its grace period to pass.
 */
export async function persistActiveRun(
  storage: MastraStorage,
  runId: string,
  {
    status = 'running',
    workflowName = 'recovered-wf',
    updatedAt,
  }: { status?: WorkflowRunStatus; workflowName?: string; updatedAt?: Date } = {},
) {
  const store = (await storage.getStore('workflows'))!;
  await store.persistWorkflowSnapshot({
    workflowName,
    runId,
    snapshot: { ...createEmptyWorkflowSnapshot(runId), status, activePaths: [], context: { input: {} } as any },
    ...(updatedAt ? { updatedAt } : {}),
  });
}

/**
 * `inner`, recording the run ID of each restart start event it publishes in `restarts`. With `drop`,
 * it never delivers a start event, as a broker that holds them or a worker that crashed with them.
 */
export function interceptStarts(
  inner: PubSub,
  { restarts, drop = false }: { restarts?: string[]; drop?: boolean },
): PubSub {
  return new Proxy(inner, {
    get(target, prop) {
      if (prop === 'publish') {
        return async (topic: string, event: Event, options?: { localOnly?: boolean }) => {
          if (topic !== 'workflows' || event.type !== 'workflow.start') {
            return target.publish(topic, event, options);
          }

          if (event.data?.restart) {
            restarts?.push(event.runId);
          }

          if (!drop) {
            return target.publish(topic, event, options);
          }
        };
      }

      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
