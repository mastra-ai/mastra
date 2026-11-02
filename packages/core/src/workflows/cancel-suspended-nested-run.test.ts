import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createWorkflow as createEventedWorkflow, createStep as createEventedStep } from './evented';
import { createStep } from './workflow';

const engines = [
  ['default', createWorkflow, createStep],
  ['evented', createEventedWorkflow, createEventedStep],
] as const;

const schema = z.object({ value: z.string() });

// Regression coverage for https://github.com/mastra-ai/mastra/issues/24780: canceling a parent left its
// suspended nested runs suspended, because only running nested runs hear the parent's abort signal.
describe.each(engines)('cancel() with suspended nested runs on the %s engine', (_engine, makeWorkflow, makeStep) => {
  const topologies = {
    // parent -> child -> grandchild suspends, next to a nested workflow that completes
    nested: () => {
      const grandchild = makeWorkflow({ id: 'grandchild', inputSchema: schema, outputSchema: schema })
        .then(
          makeStep({ id: 'pause', inputSchema: schema, outputSchema: schema, execute: ({ suspend }) => suspend({}) }),
        )
        .commit();
      const child = makeWorkflow({ id: 'child', inputSchema: schema, outputSchema: schema }).then(grandchild).commit();
      const completed = makeWorkflow({ id: 'completed', inputSchema: schema, outputSchema: schema })
        .then(
          makeStep({ id: 'done', inputSchema: schema, outputSchema: schema, execute: ({ inputData }) => inputData }),
        )
        .commit();
      const parent = makeWorkflow({ id: 'parent', inputSchema: schema, outputSchema: z.any() })
        .parallel([child, completed])
        .commit();
      return { parent, inputData: { value: 'x' } };
    },
    // foreach over a nested workflow where the 'done' iteration completes and the others suspend
    foreach: () => {
      const item = makeWorkflow({ id: 'item', inputSchema: schema, outputSchema: schema })
        .then(
          makeStep({
            id: 'maybe-pause',
            inputSchema: schema,
            outputSchema: schema,
            execute: ({ inputData, suspend }) => (inputData.value === 'done' ? inputData : suspend({})),
          }),
        )
        .commit();
      const parent = makeWorkflow({ id: 'parent', inputSchema: z.array(schema), outputSchema: z.any() })
        .foreach(item, { concurrency: 3 })
        .commit();
      return { parent, inputData: [{ value: 'a' }, { value: 'done' }, { value: 'b' }] };
    },
  };

  const host = async (storage: MockStore, topology: keyof typeof topologies) => {
    const { parent, inputData } = topologies[topology]();
    const mastra = new Mastra({ logger: false, storage, pubsub: new EventEmitterPubSub(), workflows: { parent } });
    await mastra.startWorkers();
    return { mastra, parent, inputData };
  };

  it.each([
    ['nested', false],
    ['nested', true],
    ['foreach', false],
    ['foreach', true],
  ] as const)(
    'cancels every suspended %s run from a restarted process (parent already canceled: %s)',
    async (topology, parentAlreadyCanceled) => {
      const storage = new MockStore();
      const store = (await storage.getStore('workflows'))!;
      const statuses = async () =>
        Object.fromEntries(
          (await store.listWorkflowRuns()).runs.map(run => [
            `${run.workflowName}/${run.runId}`,
            (run.snapshot as { status: string }).status,
          ]),
        );

      const first = await host(storage, topology);
      const run = await first.parent.createRun({ runId: 'parent-run' });
      expect((await run.start({ inputData: first.inputData as any })).status).toBe('suspended');
      await first.mastra.stopWorkers();
      if (parentAlreadyCanceled) {
        // The state a cancel() without this fix left behind: parent canceled, nested runs still suspended.
        await store.updateWorkflowState({ workflowName: 'parent', runId: 'parent-run', opts: { status: 'canceled' } });
      }

      const before = await statuses();
      const second = await host(storage, topology);
      try {
        await (await second.parent.createRun({ runId: 'parent-run' })).cancel();
      } finally {
        await second.mastra.stopWorkers();
      }

      const nestedSuspended = Object.entries(before).filter(
        ([key, status]) => !key.startsWith('parent/') && status === 'suspended',
      );
      expect(nestedSuspended.length).toBeGreaterThanOrEqual(2);
      expect(Object.values(before)).toContain('success');
      expect(await statuses()).toEqual(
        Object.fromEntries(
          Object.entries(before).map(([key, status]) => [key, status === 'suspended' ? 'canceled' : status]),
        ),
      );
    },
  );
});
