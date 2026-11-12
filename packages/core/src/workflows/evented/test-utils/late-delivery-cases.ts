/**
 * Shared cases for evented runs whose events arrive late or twice (#28712): a
 * step end held in the broker, a duplicate end of the run, a nested run's
 * success delivered twice, a restart that read the run before it moved on.
 * Run them against each storage.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { MastraStorage } from '../../../storage';
import { deferred, samePath, uniqueRunId, useLateDeliveryReplicas } from './late-delivery-replicas';
import { Num } from './lease-replicas';
import { createStep, createWorkflow } from '..';

/**
 * `getStorage` is the store the test reads. `connect` opens the store a
 * replica uses, on the same database (see {@link useLateDeliveryReplicas}).
 */
export function describeLateDeliveryCases({
  getStorage,
  connect = getStorage,
}: {
  getStorage: () => MastraStorage;
  connect?: () => MastraStorage | Promise<MastraStorage>;
}) {
  describe('evented runs whose events arrive late or twice (#28712)', () => {
    const { startReplica, storedRun } = useLateDeliveryReplicas({ getStorage, connect });

    it('runs the step after a foreach once when two items finish together', async () => {
      const executions: string[] = [];
      const started = { count: 0, both: deferred<void>() };
      const release = deferred<void>();
      const workflow = createWorkflow({ id: 'finished', inputSchema: z.array(Num), outputSchema: z.any() })
        .foreach(
          createStep({
            id: 'item',
            inputSchema: Num,
            outputSchema: Num,
            execute: async ({ inputData }) => {
              if (++started.count === 2) {
                started.both.resolve();
              }

              await release.promise;
              executions.push(`item:${inputData.n}`);
              return inputData;
            },
          }),
          { concurrency: 2 },
        )
        .then(
          createStep({
            id: 'after',
            inputSchema: z.any(),
            outputSchema: z.any(),
            execute: async ({ inputData }) => {
              executions.push('after');
              return inputData;
            },
          }),
        )
        .commit();
      const a = await startReplica(workflow);
      const run = await a.workflow.createRun({ runId: uniqueRunId() });
      const result = run.start({ inputData: [{ n: 1 }, { n: 2 }] });
      await started.both.promise;

      release.resolve();

      expect((await result).status).toBe('success');
      await expect.poll(async () => (await storedRun(run.runId))?.status).toBe('success');
      expect(executions.sort()).toEqual(['after', 'item:1', 'item:2']);
      expect(a.published.filter(event => event.type === 'workflow.step.run' && samePath(event, [1]))).toHaveLength(1);
    }, 20_000);
  });
}
