/**
 * Recovery of a default-engine run whose instance crashed or shut down, shared
 * by the in-memory, LibSQL and Postgres suites (#28712). Instances are separate
 * Mastra instances on one database, the way pods share one. The test files set
 * a short lease TTL before core loads.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import type { MastraStorage } from '../../storage';
import { createStep, createWorkflow } from '../../workflows';
import { Run } from '../../workflows/workflow';
import { Mastra } from '../index';
import { killableProcess } from './killable-process';
import { sharedBroker } from './shared-broker';

const GRACE_MS = 500;

/** A workflow of two steps that report `<instance>:<step>`; `hang` keeps a step from ever finishing. */
function buildWorkflow(instance: string, executions: string[], hang: (step: string) => boolean) {
  const step = (id: string) =>
    createStep({
      id,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => {
        executions.push(`${instance}:${id}`);
        if (hang(id)) {
          await new Promise<never>(() => {});
        }

        return {};
      },
    });

  return createWorkflow({ id: 'exit-wf', inputSchema: z.object({}), outputSchema: z.object({}) })
    .then(step('first'))
    .then(step('second'))
    .commit();
}

/** How the instances reach each other, and how the first one stops. */
export interface RecoveryExitCase {
  pubsub: 'in-process' | 'broker';
  exit: 'crashes' | 'shuts down';
}

const ALL_EXIT_CASES: RecoveryExitCase[] = [
  { pubsub: 'in-process', exit: 'crashes' },
  { pubsub: 'in-process', exit: 'shuts down' },
  { pubsub: 'broker', exit: 'crashes' },
  { pubsub: 'broker', exit: 'shuts down' },
];

/**
 * `getStorage` is the store the test reads. `connect` opens the store an
 * instance uses, on the same database; it defaults to `getStorage`. `cases`
 * picks the rows to run; it defaults to all of them.
 */
export function describeRecoveryExitCases({
  getStorage,
  connect = getStorage,
  cases = ALL_EXIT_CASES,
}: {
  getStorage: () => MastraStorage;
  connect?: () => MastraStorage | Promise<MastraStorage>;
  cases?: RecoveryExitCase[];
}) {
  describe('recovery of a default-engine run whose instance stopped (#28712)', () => {
    const instances: { mastra: Mastra; revive: () => void }[] = [];
    afterEach(async () => {
      vi.restoreAllMocks();
      await Promise.all(
        instances.splice(0).map(({ mastra, revive }) => {
          revive();
          return mastra.shutdown({ drainTimeout: 0 });
        }),
      );
    });

    /** Starts an instance named `name` whose `exit-wf` reports to `executions`. */
    async function startInstance(
      name: string,
      pubsub: PubSub,
      executions: string[],
      hang: (step: string) => boolean = () => false,
    ) {
      const instance = killableProcess({ storage: await connect(), pubsub });
      const mastra = new Mastra({
        logger: false,
        storage: instance.storage,
        pubsub: instance.pubsub,
        workflows: { 'exit-wf': buildWorkflow(name, executions, hang) },
        recovery: { workflowGraceMs: GRACE_MS },
      });
      await mastra.startWorkers();
      instances.push({ mastra, revive: instance.revive });
      return { mastra, kill: instance.kill };
    }

    const status = async (runId: string) =>
      (await (await getStorage().getStore('workflows'))!.loadWorkflowSnapshot({ workflowName: 'exit-wf', runId }))
        ?.status;

    // Each call returns a factory for the pubsub one instance connects to.
    const pubsubs: Record<RecoveryExitCase['pubsub'], () => () => PubSub> = {
      'in-process': () => () => new EventEmitterPubSub(),
      broker: () => {
        const broker = sharedBroker();
        return () => broker.connect();
      },
    };

    describe.each(cases.map(({ pubsub, exit }) => [pubsub, exit] as const))('with the %s pubsub', (pubsub, exit) => {
      it(`restarts a run once, after its lease lapsed and the grace period passed, when its instance ${exit} mid-step`, async () => {
        const connectPubsub = pubsubs[pubsub]();
        const executions: string[] = [];
        const a = await startInstance('A', connectPubsub(), executions, step => step === 'first');
        const run = await a.mastra.getWorkflow('exit-wf').createRun();
        // Never settles: the step hangs until the instance is gone.
        void run.start({ inputData: {} });
        await vi.waitFor(() => expect(executions).toEqual(['A:first']));

        // A shutdown does not wait for a default-engine run, which goes on holding its lease until the process exits.
        if (exit === 'shuts down') {
          await a.mastra.shutdown({ drainTimeout: 0 });
        }

        // The process is gone: nothing it held is renewed again, so its lease lapses one TTL after the last renewal.
        a.kill();
        const lease = await (await getStorage().getStore('workflows'))!.getRunOwnership({ runId: run.runId });
        const leaseExpiresAt = lease?.leaseExpiresAt?.getTime();
        expect(leaseExpiresAt).toBeDefined();

        const b = await startInstance('B', connectPubsub(), executions);
        const restartedAt: number[] = [];
        const restart = Run.prototype.restart;
        vi.spyOn(Run.prototype, 'restart').mockImplementation(function (this: Run, ...args) {
          restartedAt.push(Date.now());
          return restart.apply(this, args);
        });

        // B can start after the grace period on a slow store, so how early the restart came is checked below.
        await vi.waitFor(
          async () => {
            await b.mastra.restartAllActiveWorkflowRuns();
            expect(await status(run.runId)).toBe('success');
          },
          { timeout: 10_000, interval: 100 },
        );
        expect(restartedAt).toHaveLength(1);
        expect(restartedAt[0]!).toBeGreaterThanOrEqual(leaseExpiresAt! + GRACE_MS);
        expect(executions.filter(execution => execution.startsWith('B:'))).toEqual(['B:first', 'B:second']);
      }, 20_000);
    });
  });
}
