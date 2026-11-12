/**
 * Replicas and event helpers shared by the evented late-delivery test cases
 * (#28712). Replicas are separate Mastra instances, each with its own pubsub,
 * sharing one store the way pods share one database. The test files set a
 * short lease TTL before core loads.
 */
import { afterEach, expect } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { PubSub } from '../../../events/pubsub';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import type { MastraStorage } from '../../../storage';
import { getEntryWorkflow } from '../../step-entry';
import type { StepFlowEntry } from '../../types';
import type { Workflow } from '../../workflow';
import { WorkflowEventProcessor } from '../workflow-event-processor';
import { abandonLease } from './abandon-lease';

export type Built = { id: string; createRun: (options?: { runId?: string }) => Promise<any> };

/** A promise and the functions that settle it; `Promise.withResolvers` is newer than the library target. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

/** The attempt number of a delivery whose earlier deliveries used up the processor's delivery budget. */
export const EXHAUSTED_ATTEMPT =
  (WorkflowEventProcessor as unknown as { MAX_DELIVERY_ATTEMPTS: number }).MAX_DELIVERY_ATTEMPTS + 1;

/**
 * A copy of `event` as a broker would store it. The start of a nested run
 * carries its parent's step graph, whose functions a broker cannot store.
 */
export function copyEvent(event: Event): Event {
  try {
    return structuredClone(event);
  } catch {
    return JSON.parse(JSON.stringify(event));
  }
}

/** Whether `event` carries the execution path `path`. */
export const samePath = (event: Event, path: number[]) =>
  JSON.stringify((event.data as { executionPath?: number[] }).executionPath) === JSON.stringify(path);

/**
 * What happens to a `workflows` event a replica publishes: `'drop'` loses it,
 * as when the publishing process stops first, and a promise keeps it in the
 * broker's queue until it resolves, while the publisher goes on.
 */
export type Intercept = (event: Event) => 'drop' | Promise<void> | undefined;

/** Wraps a pubsub so the `workflows` events it publishes are recorded and pass through `intercept`. */
function recordWorkflowEvents(inner: PubSub, intercept: Intercept = () => undefined) {
  const published: Event[] = [];
  const pubsub = new Proxy(inner, {
    get(target, prop) {
      if (prop === 'publish') {
        return async (topic: string, event: Event, options?: { localOnly?: boolean }) => {
          if (topic === 'workflows') {
            const picked = intercept(event);
            if (picked === 'drop') {
              return;
            }

            published.push(copyEvent(event));

            // The publisher goes on while the broker holds the event, so a failed delivery
            // later has no caller left to reject: log it for the test's output instead.
            if (picked) {
              picked
                .then(() => target.publish(topic, event, options))
                .catch(error => console.error('A held workflow event could not be published', error));
              return;
            }
          }

          return target.publish(topic, event, options);
        };
      }

      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { pubsub, published };
}

/**
 * Starts `run` without waiting for its result. The test reads the outcome from
 * storage, and the replica that started the run may crash or never see it end,
 * so a rejection is logged for the test's output instead of being awaited.
 */
export function startInBackground(run: { start: (args: { inputData: any }) => Promise<unknown> }, inputData: unknown) {
  run.start({ inputData }).catch(error => console.error('A run started in the background rejected', error));
}

/**
 * A run ID no other test in the store used. Tests share one store, and the
 * test setup makes `randomUUID()` repeat from test to test.
 */
export const uniqueRunId = () => `${expect.getState().currentTestName?.replace(/\W+/g, '-')}-${Date.now()}`;

/** Step events a replica published for `runId`: any of them means it ran or continued a step. */
export const stepEventsOf = (published: Event[], runId: string) =>
  published
    .filter(
      event => event.runId === runId && (event.type === 'workflow.step.run' || event.type === 'workflow.step.end'),
    )
    .map(event => `${event.type}@${JSON.stringify((event.data as { executionPath?: number[] }).executionPath)}`);

/**
 * Replica helpers for one `describe` block, which shuts its replicas down after
 * each test. `getStorage` is the store the test reads. `connect` opens the store
 * a replica uses, on the same database: a replica that shuts down closes its
 * store. It defaults to `getStorage`, for stores that close harmlessly.
 */
export function useLateDeliveryReplicas({
  getStorage,
  connect = getStorage,
}: {
  getStorage: () => MastraStorage;
  connect?: () => MastraStorage | Promise<MastraStorage>;
}) {
  const replicas: Mastra[] = [];
  afterEach(async () => {
    await Promise.all(replicas.splice(0).map(mastra => mastra.shutdown({ drainTimeout: 0 })));
  });

  /**
   * Starts a replica running `workflow` and the nested workflows its top-level
   * steps call. `published` records the `workflows` events it publishes,
   * `delivered` the same events as its subscribers receive them, with the id a
   * broker keeps on redelivery, and `finished` the events it published on
   * `workflows-finish`, one per end of a run.
   */
  async function startReplica<W extends Built>(workflow: W, intercept?: Intercept) {
    const { pubsub, published } = recordWorkflowEvents(new EventEmitterPubSub(), intercept);
    const graph = (workflow as unknown as { stepGraph: StepFlowEntry[] }).stepGraph;
    const nested = graph.flatMap(entry => {
      const child = entry.type === 'step' ? getEntryWorkflow(entry) : null;
      return child ? [[child.id, child] as const] : [];
    });
    const mastra = new Mastra({
      logger: false,
      storage: await connect(),
      pubsub,
      workflows: { [workflow.id]: workflow, ...Object.fromEntries(nested) } as unknown as Record<string, Workflow>,
    });
    await mastra.startWorkers();
    replicas.push(mastra);

    const delivered: Event[] = [];
    await pubsub.subscribe('workflows', event => {
      delivered.push(copyEvent(event));
    });

    const finished: Event[] = [];
    await pubsub.subscribe('workflows-finish', event => {
      finished.push(event);
    });

    return { mastra, published, delivered, finished, workflow };
  }

  /** A replica crashing: it stops renewing anything, and the leases it held lapse. */
  async function crash(replica: { mastra: Mastra }, keys: string[]) {
    await replica.mastra.shutdown({ drainTimeout: 0 });
    await abandonLease(getStorage(), ...keys);
  }

  /** The stored snapshot of run `runId` of the workflow `workflowName` (`finished` by default). */
  async function storedRun(runId: string, workflowName = 'finished') {
    const store = (await getStorage().getStore('workflows'))!;
    return store.loadWorkflowSnapshot({ workflowName, runId });
  }

  /** Hands `event` to `replica` the way a broker redelivers a message whose ack was lost. */
  const redeliver = (replica: { mastra: Mastra }, event: Event) =>
    replica.mastra.handleWorkflowEvent({ ...copyEvent(event), deliveryAttempt: 2 });

  return { startReplica, crash, storedRun, redeliver };
}
