/**
 * Recovery of an evented run whose instance crashed or shut down, shared by
 * the in-memory, LibSQL and Postgres suites (#28712). Instances are separate
 * Mastra instances on one database, the way pods share one. The test files set
 * a short lease TTL before core loads.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import type { MastraStorage } from '../../storage';
import { createStep, createWorkflow } from '../../workflows/evented';
import { Run } from '../../workflows/workflow';
import { Mastra } from '../index';
import { killableProcess } from './killable-process';
import { sharedBroker } from './shared-broker';

// Above one and a half liveness renew intervals at the 600 ms lease TTL the suites use.
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

/**
 * `getStorage` is the store the test reads. `connect` opens the store an
 * instance uses, on the same database; it defaults to `getStorage`.
 */
export function describeRecoveryExitCases({
  getStorage,
  connect = getStorage,
}: {
  getStorage: () => MastraStorage;
  connect?: () => MastraStorage | Promise<MastraStorage>;
}) {
  describe('recovery of an evented run whose instance stopped (#28712)', () => {
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
        // Registered under its id: the workers resolve an evented workflow by the id its events carry.
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

    describe.each([
      ['an in-process pubsub per instance', () => () => new EventEmitterPubSub() as PubSub],
      [
        'a broker the instances share',
        () => {
          const broker = sharedBroker();
          return () => broker.connect();
        },
      ],
    ])('with %s', (_, pubsubs) => {
      it.each(['crashes', 'shuts down'] as const)(
        'restarts a run once, after the grace period, when its instance %s mid-step, and runs each step once after it',
        async exit => {
          const connectPubsub = pubsubs();
          const executions: string[] = [];
          const a = await startInstance('A', connectPubsub(), executions, step => step === 'first');
          const run = await a.mastra.getWorkflow('exit-wf').createRun();
          await run.startAsync({ inputData: {} });
          await vi.waitFor(() => expect(executions).toEqual(['A:first']));

          if (exit === 'shuts down') {
            await a.mastra.shutdown({ drainTimeout: 0 });
          }

          // The process is gone: nothing it held is renewed again.
          a.kill();
          const exitedAt = Date.now();

          const b = await startInstance('B', connectPubsub(), executions);
          const restartedAt: number[] = [];
          const restartInBackground = Run.prototype.restartInBackground;
          vi.spyOn(Run.prototype, 'restartInBackground').mockImplementation(function (this: Run) {
            restartedAt.push(Date.now());
            return restartInBackground.call(this);
          });

          // Right away the run is still live, or within its grace period.
          await b.mastra.restartAllActiveWorkflowRuns();
          expect(restartedAt).toEqual([]);

          await vi.waitFor(
            async () => {
              await b.mastra.restartAllActiveWorkflowRuns();
              expect(await status(run.runId)).toBe('success');
            },
            { timeout: 10_000, interval: 100 },
          );
          expect(restartedAt).toHaveLength(1);
          expect(restartedAt[0]! - exitedAt).toBeGreaterThanOrEqual(GRACE_MS);
          expect(executions.filter(execution => execution.startsWith('B:'))).toEqual(['B:first', 'B:second']);
        },
        20_000,
      );
    });
  });
}
