import { Mastra } from '@mastra/core/mastra';
import type { MastraStorage, WorkflowRun, WorkflowsStorage } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import type { AnyWorkflow } from '@mastra/core/workflows';
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

const num = z.object({ n: z.number() });
const marks = z.object({ marked: z.number().optional() });

function addOne(id: string, onRun?: (ctx: { setState: (state: z.infer<typeof marks>) => Promise<void> }) => unknown) {
  return createStep({
    id,
    inputSchema: num,
    outputSchema: num,
    stateSchema: marks,
    execute: async ({ inputData, setState }) => {
      await onRun?.({ setState });
      return { n: inputData.n + 1 };
    },
  });
}

const TIMESTAMP_KEYS = new Set(['startedAt', 'endedAt', 'suspendedAt', 'resumedAt', 'timestamp']);

/** Drops timestamps and replaces the run id, the only values that differ between a v1 and a v2 run. */
function normalize(value: unknown, runId: string): unknown {
  if (typeof value === 'string') return value.replaceAll(runId, '<runId>');
  if (Array.isArray(value)) return value.map(v => normalize(v, runId));
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !TIMESTAMP_KEYS.has(key))
      .map(([key, v]) => [key, normalize(v, runId)]),
  );
}

const parsed = (run: WorkflowRun) => (typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot);

type Scenario = {
  /** Builds the workflow; `id` namespaces workflow ids so runs from other tests never mix in. */
  build: (id: (name: string) => string, storageVersion: 1 | 2) => AnyWorkflow;
  /** The workflows (by `id` name) that store runs, including nested ones. */
  stores: string[];
  drive: (workflow: AnyWorkflow, runId: string) => Promise<unknown>;
};

const startOnly: Scenario['drive'] = async (workflow, runId) =>
  (await workflow.createRun({ runId })).start({ inputData: { n: 0 }, initialState: {} });

const scenarios: Record<string, Scenario> = {
  'parallel and branch': {
    build: (id, storageVersion) =>
      createWorkflow({ id: id('fan'), inputSchema: num, outputSchema: z.any(), options: { storageVersion } })
        .parallel([addOne('left'), addOne('right')])
        .map(async ({ inputData }) => ({ n: inputData.left!.n + inputData.right!.n }))
        .branch([
          [async ({ inputData }) => inputData.n > 1, addOne('big')],
          [async ({ inputData }) => inputData.n <= 1, addOne('small')],
        ])
        .commit(),
    stores: ['fan'],
    drive: startOnly,
  },
  'dowhile and foreach with concurrency': {
    build: (id, storageVersion) =>
      createWorkflow({ id: id('loops'), inputSchema: num, outputSchema: z.any(), options: { storageVersion } })
        .dowhile(addOne('count'), async ({ inputData }) => inputData.n < 3)
        .map(async ({ inputData }) => [{ n: inputData.n }, { n: inputData.n * 2 }, { n: inputData.n * 3 }])
        .foreach(addOne('each'), { concurrency: 2 })
        .commit(),
    stores: ['loops'],
    drive: startOnly,
  },
  'nested workflow': {
    build: (id, storageVersion) => {
      const inner = createWorkflow({
        id: id('inner'),
        inputSchema: num,
        outputSchema: num,
        stateSchema: marks,
        options: { storageVersion },
      })
        .then(addOne('inner-a', ({ setState }) => setState({ marked: 2 })))
        .then(addOne('inner-b'))
        .commit();
      return createWorkflow({
        id: id('outer'),
        inputSchema: num,
        outputSchema: num,
        stateSchema: marks,
        options: { storageVersion },
      })
        .then(addOne('before'))
        .then(inner)
        .then(addOne('after'))
        .commit();
    },
    stores: ['outer', 'inner'],
    drive: startOnly,
  },
  'suspend and resume': {
    build: (id, storageVersion) =>
      createWorkflow({
        id: id('gated'),
        inputSchema: z.object({}),
        outputSchema: z.object({ approved: z.boolean() }),
        options: { storageVersion },
      })
        .then(
          createStep({
            id: 'gate',
            inputSchema: z.object({}),
            outputSchema: z.object({ approved: z.boolean() }),
            resumeSchema: z.boolean(),
            execute: async ({ resumeData, suspend }) => {
              if (resumeData === undefined) return suspend({});
              return { approved: resumeData };
            },
          }),
        )
        .commit(),
    stores: ['gated'],
    drive: async (workflow, runId) => {
      const suspended = await (await workflow.createRun({ runId })).start({ inputData: {} });
      expect(suspended.status).toBe('suspended');
      return (await workflow.createRun({ runId })).resume({ step: 'gate', resumeData: true });
    },
  },
};

/**
 * Runs workflows on the default engine against the adapter, on storage v1 and v2, and checks
 * that both give the same result and store the same runs. Skipped for adapters whose
 * `supportsRunJournal()` is false.
 */
export function createWorkflowEngineTests({
  storage,
  getStore,
}: {
  storage: MastraStorage;
  getStore: () => WorkflowsStorage;
}) {
  describe('workflows on storage v1 and v2', () => {
    let store: WorkflowsStorage;
    let prefix: string;

    beforeEach(ctx => {
      store = getStore();
      if (!store.supportsRunJournal()) return ctx.skip();
      prefix = `engine-${randomUUID()}`;
    });

    const id = (name: string) => `${prefix}-${name}`;

    /** Runs a scenario on one storage version and returns its result plus every run it stored, reloaded. */
    async function runAndReadBack(storageVersion: 1 | 2, { build, stores, drive }: Scenario) {
      const runId = `${prefix}-v${storageVersion}`;
      const workflow = build(id, storageVersion);
      new Mastra({ logger: false, storage, workflows: { [workflow.id]: workflow } });
      const result = await drive(workflow, runId);

      const runs: Record<string, unknown> = {};
      for (const name of stores) {
        const workflowName = id(name);
        const listed = await store.listWorkflowRuns({ workflowName, perPage: false });
        for (const run of listed.runs.filter(r => (r.storageVersion ?? 1) === storageVersion)) {
          const loaded = normalize(
            await store.loadWorkflowSnapshot({ workflowName, runId: run.runId, storageVersion }),
            runId,
          );
          expect(normalize(parsed(run), runId)).toEqual(loaded);
          runs[`${name}/${normalize(run.runId, runId)}`] = loaded;
        }
      }
      return { result: normalize(result, runId), runs };
    }

    for (const [name, scenario] of Object.entries(scenarios)) {
      it(`stores the same run on v2 as on v1: ${name}`, async () => {
        const v1 = await runAndReadBack(1, scenario);
        const v2 = await runAndReadBack(2, scenario);
        expect(Object.keys(v1.runs).length).toBeGreaterThan(0);
        expect(v2).toEqual(v1);
      });
    }

    it('sends only the changed steps on each v2 write', async () => {
      const STEPS = 10;
      const writes: { checkpoint: boolean; status: string; stepIds: string[]; state: boolean }[] = [];
      const { writeWorkflowRunCheckpoint, appendWorkflowRunEntries, persistWorkflowSnapshot } = store;
      store.writeWorkflowRunCheckpoint = function (args) {
        writes.push({ checkpoint: true, status: args.header.status, stepIds: Object.keys(args.steps), state: true });
        return writeWorkflowRunCheckpoint.call(this, args);
      };
      store.appendWorkflowRunEntries = function (args) {
        writes.push({
          checkpoint: false,
          status: args.header.status,
          stepIds: Object.keys(args.steps),
          state: args.state !== undefined,
        });
        return appendWorkflowRunEntries.call(this, args);
      };
      store.persistWorkflowSnapshot = () => Promise.reject(new Error('a v2 run wrote through persistWorkflowSnapshot'));

      try {
        let workflow: any = createWorkflow({
          id: id('sequential'),
          inputSchema: num,
          outputSchema: num,
          stateSchema: marks,
          options: { storageVersion: 2 },
        });
        for (let i = 0; i < STEPS; i++) {
          workflow = workflow.then(addOne(`s${i}`, i === 5 ? ({ setState }) => setState({ marked: i }) : undefined));
        }
        workflow.commit();
        new Mastra({ logger: false, storage, workflows: { [workflow.id]: workflow } });

        const runId = `${prefix}-run`;
        const result = await (await workflow.createRun({ runId })).start({ inputData: { n: 0 }, initialState: {} });
        expect(result.status).toBe('success');
        expect(result.result).toEqual({ n: STEPS });

        // createRun's pending write and the first running write are checkpoints; every later write is an append.
        expect(writes.slice(0, 2).map(w => w.checkpoint)).toEqual([true, true]);
        const appends = writes.slice(2);
        expect(appends.length).toBeGreaterThan(STEPS);
        for (const { checkpoint, status, stepIds } of appends) {
          expect(checkpoint).toBe(false);
          expect(stepIds).toHaveLength(status === 'running' ? 1 : 0);
        }
        expect(appends.filter(w => w.state)).toEqual([
          { checkpoint: false, status: 'running', stepIds: ['s5'], state: true },
          { checkpoint: false, status: 'success', stepIds: [], state: true },
        ]);

        const stored = await store.loadWorkflowSnapshot({ workflowName: id('sequential'), runId, storageVersion: 2 });
        expect(stored?.status).toBe('success');
        expect(stored?.value).toEqual({ marked: 5 });
        expect(Object.keys(stored!.context)).toEqual(['input', ...Array.from({ length: STEPS }, (_, i) => `s${i}`)]);
        expect(stored!.context[`s${STEPS - 1}`]).toMatchObject({ status: 'success', output: { n: STEPS } });
      } finally {
        Object.assign(store, { writeWorkflowRunCheckpoint, appendWorkflowRunEntries, persistWorkflowSnapshot });
      }
    });
  });
}
