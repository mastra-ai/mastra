import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PostgresStore } from '../..';
import { Mastra } from '../../../../../../packages/core/src/mastra';
import { createStep, createWorkflow } from '../../../../../../packages/core/src/workflows/evented';
import { describeLoopCallbackFailures } from '../../../../../../packages/core/src/workflows/evented/test-utils/loop-callback-failure-cases';
import { RedeliveryDriver } from '../../../../../../packages/core/src/workflows/evented/test-utils/redelivery-driver';
import { TEST_CONFIG } from '../../test-utils';

// Step guards move loop-condition evaluation to the guarded completion path (COR-1466).
describe('Postgres evented loop callback failures', () => {
  const schemaName = `loop_callback_${Date.now()}`;
  const storage = new PostgresStore({ ...TEST_CONFIG, id: 'loop-callback', schemaName });
  beforeAll(async () => {
    await storage.init();
    expect((await storage.getStore('workflows'))!.supportsWorkflowStepGuards()).toBe(true);
  });
  afterAll(async () => {
    await storage.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await storage.close();
  });

  describeLoopCallbackFailures({ getStorage: () => storage });

  // A lost ack redelivers the event that ran the body and the throwing condition.
  it.each(['step', 'nested workflow'] as const)(
    'does not run the loop again when the failed iteration is redelivered late (%s body)',
    async bodyKind => {
      const driver = new RedeliveryDriver();
      const schema = z.object({ n: z.number() });
      let bodyCalls = 0;
      let conditionCalls = 0;
      const loopId = `late-redelivery-${bodyKind.replace(' ', '-')}`;
      const charge = createStep({
        id: 'charge',
        inputSchema: schema,
        outputSchema: schema,
        execute: async ({ inputData }) => {
          bodyCalls++;
          return { n: inputData.n + 1 };
        },
      });
      const body =
        bodyKind === 'step'
          ? charge
          : createWorkflow({ id: `${loopId}-child`, inputSchema: schema, outputSchema: schema })
              .then(charge)
              .commit();
      const workflow = createWorkflow({ id: loopId, inputSchema: schema, outputSchema: schema })
        .dowhile(body, async () => {
          conditionCalls++;
          throw new Error('condition boom');
        })
        .commit();
      const mastra = new Mastra({ logger: false, storage, pubsub: driver.pubsub, workflows: { [loopId]: workflow } });
      await mastra.startWorkers();
      try {
        const run = await workflow.createRun();
        expect(await run.start({ inputData: { n: 0 } })).toMatchObject({ status: 'failed' });

        const original =
          bodyKind === 'step'
            ? driver.stepRuns({ spec: '0', runId: run.runId })[0]!
            : driver.events.find(
                event => event.type === 'workflow.end' && event.data.workflowId === `${loopId}-child`,
              )!;
        const leaseKey = `workflow-step-run:${original.runId}:${original.id}`;
        const owner = await driver.pubsub.getLeaseOwner(leaseKey);
        if (owner) await driver.pubsub.releaseLease(leaseKey, owner);
        const failures = () => driver.events.filter(event => event.type === 'workflow.fail').length;
        const failuresBefore = failures();
        const eventsBefore = driver.events.length;
        await driver.redeliverEvent(original);

        if (bodyKind === 'step') {
          // A step body replays like any failed step, which republishes workflow.fail.
          await expect.poll(failures).toBe(failuresBefore + 1);
        } else {
          // The nested replay sees the ended run and publishes nothing.
          expect(driver.events.slice(eventsBefore).map(event => event.type)).toEqual(['workflow.end']);
        }
        expect(bodyCalls).toBe(1);
        expect(conditionCalls).toBe(1);
        const store = (await storage.getStore('workflows'))!;
        const snapshot = await store.loadWorkflowSnapshot({ workflowName: loopId, runId: run.runId });
        expect(snapshot?.status).toBe('failed');
        expect(snapshot?.context[body.id]).toMatchObject({ status: 'failed', error: { message: 'condition boom' } });
      } finally {
        await mastra.stopWorkers();
        driver.dispose();
      }
    },
    8_000,
  );
});
