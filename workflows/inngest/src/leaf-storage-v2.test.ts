/**
 * Storage v2 Inngest runs: each plain step runs as a synthetic leaf function and its outcome is adopted
 * atomically into the run. Runs against a real Inngest dev server and real Mastra stores; crashes are
 * injected after durable writes and before Inngest records the step that made them.
 */
import { createServer } from 'node:net';
import type { ServerType } from '@hono/node-server';
import { serve as nodeServe } from '@hono/node-server';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraCompositeStore, WorkflowsStorage } from '@mastra/core/storage';
import { DefaultStorage } from '@mastra/libsql';
import { execa } from 'execa';
import type { ResultPromise } from 'execa';
import { Hono } from 'hono';
import { Inngest } from 'inngest';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ensureInngestCliBinary } from './__tests__/inngest-cli';
import { __setLeafFaultHook } from './leaf/contracts';
import type { LeafFaultPoint } from './leaf/contracts';
import { init, serve as inngestServe } from './index';

let inngestPort = 0;
let handlerPort = 0;
let devServer: ResultPromise | null = null;
let handlerServer: ServerType | null = null;

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(check: () => Promise<boolean>, message: string, tries = 120) {
  for (let i = 0; i < tries; i++) {
    if (await check().catch(() => false)) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(message);
}

const stores: Record<string, () => MastraCompositeStore> = {
  'in-memory': () => new InMemoryStore(),
  libsql: () => new DefaultStorage({ id: 'leaf-storage-v2', url: ':memory:' }),
};

async function setup(makeStore: () => MastraCompositeStore, build: (helpers: ReturnType<typeof init>) => any) {
  inngestPort = await getFreePort();
  handlerPort = await getFreePort();
  const inngest = new Inngest({ id: 'leaf-storage-v2-test', baseUrl: `http://localhost:${inngestPort}` });
  const workflow = build(init(inngest));
  const mastra = new Mastra({ logger: false, storage: makeStore(), workflows: { [workflow.id]: workflow } });

  const app = new Hono();
  app.all('/inngest/api', c => inngestServe({ mastra, inngest })(c));
  handlerServer = nodeServe({ fetch: app.fetch, port: handlerPort });

  devServer = execa(
    ensureInngestCliBinary(),
    [
      'dev',
      '-p',
      String(inngestPort),
      '-u',
      `http://localhost:${handlerPort}/inngest/api`,
      '--no-discovery',
      '--poll-interval=1',
      '--retry-interval=1',
    ],
    { stdio: 'ignore', reject: false },
  );
  await waitFor(async () => (await fetch(`http://localhost:${inngestPort}/dev`)).ok, 'dev server did not start');
  await fetch(`http://localhost:${handlerPort}/inngest/api`, { method: 'PUT' });
  await waitFor(async () => {
    const data = await (await fetch(`http://localhost:${inngestPort}/dev`)).json();
    const slugs: string[] = (data.functions ?? []).map((fn: { slug?: string }) => fn.slug ?? '');
    return slugs.some(s => s.endsWith(`workflow.${workflow.id}`)) && slugs.some(s => s.endsWith('leaf.v1'));
  }, 'workflow functions were not registered');

  const store = (await mastra.getStorage()!.getStore('workflows')) as WorkflowsStorage;
  return { workflow, store };
}

afterEach(async () => {
  __setLeafFaultHook(undefined);
  handlerServer?.close();
  handlerServer = null;
  devServer?.kill();
  await devServer?.catch(() => {});
  devServer = null;
  await waitFor(async () => {
    try {
      await fetch(`http://localhost:${inngestPort}/dev`);
      return false;
    } catch {
      return true;
    }
  }, 'dev server did not shut down');
});

/** Throws once at `point`, as if the process died right after that durable write. */
function crashOnceAt(point: LeafFaultPoint) {
  const crashed = { count: 0 };
  __setLeafFaultHook(at => {
    if (at === point && crashed.count === 0) {
      crashed.count++;
      throw new Error(`injected crash at ${point}`);
    }
  });
  return crashed;
}

const stateSchema = z.object({ count: z.number().optional(), a: z.string().optional(), b: z.string().optional() });

/** A counts to 1, B reads A's output and counts on from the state. */
function countingWorkflow(
  { createWorkflow, createStep }: ReturnType<typeof init>,
  calls: Record<string, number>,
  options: { retries?: number; failFirstA?: boolean } = {},
) {
  const a = createStep({
    id: 'a',
    inputSchema: z.object({ start: z.number() }),
    outputSchema: z.object({ fromA: z.number() }),
    stateSchema,
    retries: options.failFirstA ? 1 : 0,
    execute: async ({ inputData, setState, state }) => {
      calls.a = (calls.a ?? 0) + 1;
      await setState({ ...state, count: inputData.start + calls.a * 100 });
      if (options.failFirstA && calls.a === 1) throw new Error('first attempt fails');
      return { fromA: inputData.start };
    },
  });
  const b = createStep({
    id: 'b',
    inputSchema: z.object({ fromA: z.number() }),
    outputSchema: z.object({ total: z.number() }),
    stateSchema,
    execute: async ({ inputData, state, setState, getStepResult }) => {
      calls.b = (calls.b ?? 0) + 1;
      const fromA = (getStepResult('a') as { fromA: number }).fromA;
      await setState({ ...state, count: (state.count ?? 0) + 1 });
      return { total: fromA + inputData.fromA + (state.count ?? 0) };
    },
  });
  return createWorkflow({
    id: 'leaf-counting',
    inputSchema: z.object({ start: z.number() }),
    outputSchema: z.object({ total: z.number() }),
    stateSchema,
    options: { storageVersion: 2 },
    retries: options.retries,
  })
    .then(a)
    .then(b)
    .commit();
}

for (const [storeName, makeStore] of Object.entries(stores)) {
  describe(`Inngest storage v2 leaves (${storeName})`, () => {
    it('runs plain steps as leaves and adopts their state and results', async () => {
      const calls: Record<string, number> = {};
      const { workflow, store } = await setup(makeStore, helpers => countingWorkflow(helpers, calls));
      const run = await workflow.createRun();
      expect(run.storageVersion).toBe(2);

      const result: any = await run.start({ inputData: { start: 1 } });

      expect(result.status).toBe('success');
      // A set count to 101; B read it and counted on.
      expect(result.result).toEqual({ total: 1 + 1 + 101 });
      expect(calls).toEqual({ a: 1, b: 1 });

      const stored = await store.loadWorkflowRun({ workflowName: 'leaf-counting', runId: run.runId });
      expect(stored?.header.status).toBe('success');
      expect(stored?.state).toEqual({ count: 102 });
      expect((stored?.steps.a as any).output).toEqual({ fromA: 1 });
      expect((stored?.steps.b as any).output).toEqual({ total: 103 });
      // v1 snapshot table is untouched.
      expect(
        await store.loadWorkflowSnapshot({ workflowName: 'leaf-counting', runId: run.runId, storageVersion: 1 }),
      ).toBeNull();
    });

    it('retries a failing step from the same pinned state and discards the failed attempt', async () => {
      const calls: Record<string, number> = {};
      const { workflow, store } = await setup(makeStore, helpers =>
        countingWorkflow(helpers, calls, { failFirstA: true }),
      );
      const run = await workflow.createRun();
      const result: any = await run.start({ inputData: { start: 1 } });

      expect(result.status).toBe('success');
      expect(calls).toEqual({ a: 2, b: 1 });
      // Attempt 2's count (201), not attempt 1's; B counts on from it.
      const stored = await store.loadWorkflowRun({ workflowName: 'leaf-counting', runId: run.runId });
      expect(stored?.state).toEqual({ count: 202 });
    });

    for (const point of ['candidate-staged', 'final-written'] as const) {
      it(`recovers a leaf that crashed after ${point}`, async () => {
        const calls: Record<string, number> = {};
        const crashed = crashOnceAt(point);
        const { workflow, store } = await setup(makeStore, helpers => countingWorkflow(helpers, calls));
        const run = await workflow.createRun();
        const result: any = await run.start({ inputData: { start: 1 } });

        expect(crashed.count).toBe(1);
        expect(result.status).toBe('success');
        // A crash before finalize re-runs the step; one after it only re-reads the chosen candidate.
        expect(calls.a).toBe(point === 'candidate-staged' ? 2 : 1);
        expect(calls.b).toBe(1);
        const stored = await store.loadWorkflowRun({ workflowName: 'leaf-counting', runId: run.runId });
        expect(stored?.state.count).toBe(1 + calls.a * 100 + 1);
      });
    }

    it('adopts once when the parent crashed after the adoption was written', async () => {
      const calls: Record<string, number> = {};
      const crashed = crashOnceAt('adoption-written');
      const { workflow, store } = await setup(makeStore, helpers => countingWorkflow(helpers, calls, { retries: 1 }));
      const run = await workflow.createRun();
      const result: any = await run.start({ inputData: { start: 1 } });

      expect(crashed.count).toBe(1);
      expect(result.status).toBe('success');
      // The parent's retry found the stored receipt instead of running or adopting the step again.
      expect(calls).toEqual({ a: 1, b: 1 });
      const stored = await store.loadWorkflowRun({ workflowName: 'leaf-counting', runId: run.runId });
      expect(stored?.state).toEqual({ count: 102 });
    });

    it('keeps sibling edits of parallel leaves', async () => {
      const { workflow, store } = await setup(makeStore, ({ createWorkflow, createStep }) => {
        const arm = (id: 'a' | 'b') =>
          createStep({
            id,
            inputSchema: z.object({}),
            outputSchema: z.object({ id: z.string() }),
            stateSchema,
            execute: async ({ state, setState }) => {
              await setState({ ...state, [id]: id });
              return { id };
            },
          });
        return createWorkflow({
          id: 'leaf-counting',
          inputSchema: z.object({}),
          outputSchema: z.any(),
          stateSchema,
          options: { storageVersion: 2 },
        })
          .parallel([arm('a'), arm('b')])
          .commit();
      });
      const run = await workflow.createRun();
      const result: any = await run.start({
        inputData: {},
        initialState: { count: 7 },
        outputOptions: { includeState: true },
      });

      expect(result.status).toBe('success');
      expect(result.state).toEqual({ count: 7, a: 'a', b: 'b' });
      const stored = await store.loadWorkflowRun({ workflowName: 'leaf-counting', runId: run.runId });
      expect(stored?.state).toEqual({ count: 7, a: 'a', b: 'b' });
    });

    it('runs foreach items as leaves and retries the execution, not the item, after an adoption crash', async () => {
      const calls: number[] = [];
      const crashed = crashOnceAt('adoption-written');
      const { workflow, store } = await setup(makeStore, ({ createWorkflow, createStep }) => {
        const double = createStep({
          id: 'double',
          inputSchema: z.number(),
          outputSchema: z.number(),
          execute: async ({ inputData }) => {
            calls.push(inputData);
            return inputData * 2;
          },
        });
        return createWorkflow({
          id: 'leaf-counting',
          inputSchema: z.array(z.number()),
          outputSchema: z.array(z.number()),
          options: { storageVersion: 2 },
          retries: 1,
        })
          .foreach(double)
          .commit();
      });
      const run = await workflow.createRun();
      const result: any = await run.start({ inputData: [1, 2, 3] });

      expect(crashed.count).toBe(1);
      expect(result.status).toBe('success');
      expect(result.result).toEqual([2, 4, 6]);
      // Each item ran once: the crashed item's adoption was found on the retried execution.
      expect([...calls].sort()).toEqual([1, 2, 3]);
      const stored = await store.loadWorkflowRun({ workflowName: 'leaf-counting', runId: run.runId });
      expect(stored?.header.status).toBe('success');
      expect((stored?.steps.double as any).output).toEqual([2, 4, 6]);
    });

    it('suspends in a leaf and resumes into a new occurrence', async () => {
      const calls: Record<string, number> = {};
      const { workflow, store } = await setup(makeStore, ({ createWorkflow, createStep }) => {
        const ask = createStep({
          id: 'ask',
          inputSchema: z.object({}),
          outputSchema: z.object({ answer: z.string() }),
          resumeSchema: z.object({ answer: z.string() }),
          stateSchema,
          execute: async ({ resumeData, suspend, state, setState }) => {
            calls.ask = (calls.ask ?? 0) + 1;
            if (!resumeData) {
              await setState({ ...state, a: 'asked' });
              return suspend({ question: 'why?' });
            }
            await setState({ ...state, b: resumeData.answer });
            return { answer: resumeData.answer };
          },
        });
        return createWorkflow({
          id: 'leaf-counting',
          inputSchema: z.object({}),
          outputSchema: z.object({ answer: z.string() }),
          stateSchema,
          options: { storageVersion: 2 },
        })
          .then(ask)
          .commit();
      });
      const run = await workflow.createRun();
      const first: any = await run.start({ inputData: {} });
      expect(first.status).toBe('suspended');
      const suspended = await store.loadWorkflowRun({ workflowName: 'leaf-counting', runId: run.runId });
      expect(suspended?.header.status).toBe('suspended');
      expect(suspended?.state).toEqual({ a: 'asked' });
      expect((suspended?.steps.ask as any).suspendPayload).toMatchObject({ question: 'why?' });

      const resumed: any = await run.resume({ step: 'ask', resumeData: { answer: 'because' } });
      expect(resumed.status).toBe('success');
      expect(resumed.result).toEqual({ answer: 'because' });
      expect(calls.ask).toBe(2);
      const done = await store.loadWorkflowRun({ workflowName: 'leaf-counting', runId: run.runId });
      expect(done?.header.status).toBe('success');
      expect(done?.state).toEqual({ a: 'asked', b: 'because' });
    });
  });
}
