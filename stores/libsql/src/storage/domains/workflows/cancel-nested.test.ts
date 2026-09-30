import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { toStandardSchema } from '@mastra/core/schema';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../index';

// Regression coverage for https://github.com/mastra-ai/mastra/issues/24780 against a real
// database: each "process" opens its own LibSQLStore over the same file.
describe('Run.cancel after restart with LibSQL storage', () => {
  const schema = toStandardSchema<Record<string, never>>({ type: 'object' });
  const itemSchema = toStandardSchema<{ n: number }>({
    type: 'object',
    properties: { n: { type: 'number' } },
    required: ['n'],
  });
  let dir: string;
  let url: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mastra-cancel-'));
    url = `file:${join(dir, 'db.sqlite')}`;
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function buildNested() {
    const wait = createStep({
      id: 'wait',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ suspend }) => suspend({}),
    });
    const grandchild = createWorkflow({ id: 'grandchild', inputSchema: schema, outputSchema: schema })
      .then(wait)
      .commit();
    const child = createWorkflow({ id: 'child', inputSchema: schema, outputSchema: schema }).then(grandchild).commit();
    return createWorkflow({ id: 'parent', inputSchema: schema, outputSchema: schema }).then(child).commit();
  }

  function buildForeach() {
    const maybeSuspend = createStep({
      id: 'maybe-suspend',
      inputSchema: itemSchema,
      outputSchema: itemSchema,
      execute: async ({ inputData, suspend }) => (inputData.n % 2 ? suspend({}) : inputData),
    });
    const child = createWorkflow({ id: 'child', inputSchema: itemSchema, outputSchema: itemSchema })
      .then(maybeSuspend)
      .commit();
    return createWorkflow({
      id: 'parent',
      inputSchema: toStandardSchema<{ n: number }[]>({ type: 'array', items: { type: 'object' } }),
      outputSchema: toStandardSchema({}),
    })
      .foreach(child, { concurrency: 10 })
      .commit();
  }

  const newProcess = (build: () => ReturnType<typeof buildNested>) =>
    new Mastra({ logger: false, storage: new LibSQLStore({ id: 'cancel-test', url }), workflows: { parent: build() } });

  it('cancels suspended child and grandchild runs from a recreated run', async () => {
    const processA = newProcess(buildNested);
    const run = await processA.getWorkflow('parent').createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');

    const processB = newProcess(buildNested);
    const store = (await processB.getStorage()!.getStore('workflows'))!;
    const result = await (await processB.getWorkflow('parent').createRun({ runId: run.runId })).cancel();
    expect(result.failed).toEqual([]);

    const { runs } = await store.listWorkflowRuns({});
    expect(runs.map(r => r.workflowName).sort()).toEqual(['child', 'grandchild', 'parent']);
    for (const r of runs) {
      expect((r.snapshot as WorkflowRunState).status, r.workflowName).toBe('canceled');
    }
  });

  it('cancels suspended foreach iterations and keeps completed ones', async () => {
    const processA = newProcess(buildForeach as any);
    const run = await processA.getWorkflow('parent').createRun();
    const started = await run.start({ inputData: Array.from({ length: 10 }, (_, n) => ({ n })) });
    expect(started.status).toBe('suspended');

    const processB = newProcess(buildForeach as any);
    const store = (await processB.getStorage()!.getStore('workflows'))!;
    const before = (await store.listWorkflowRuns({ workflowName: 'child' })).runs;
    expect(before.filter(r => (r.snapshot as WorkflowRunState).status === 'suspended')).toHaveLength(5);

    const result = await (await processB.getWorkflow('parent').createRun({ runId: run.runId })).cancel();
    expect(result.failed).toEqual([]);

    for (const child of before) {
      const prev = (child.snapshot as WorkflowRunState).status;
      const now = (await store.loadWorkflowSnapshot({ workflowName: 'child', runId: child.runId }))?.status;
      expect(now, child.runId).toBe(prev === 'suspended' ? 'canceled' : prev);
    }
  });

  it.each([
    ['running', 'canceled'],
    ['success', 'success'],
  ] as const)(
    'uses the database conditional write when a child moves to %s mid-cancel',
    async (raceStatus, expected) => {
      const processA = newProcess(buildNested);
      const run = await processA.getWorkflow('parent').createRun();
      await run.start({ inputData: {} });

      const processB = newProcess(buildNested);
      const store = (await processB.getStorage()!.getStore('workflows'))!;
      expect(store.supportsConcurrentUpdates()).toBe(true);

      // A different connection (another worker) changes the child's status right before our write.
      const otherWorker = (await new LibSQLStore({ id: 'other', url }).getStore('workflows'))!;
      const original = store.updateWorkflowState.bind(store);
      let raced = false;
      store.updateWorkflowState = async args => {
        if (args.workflowName === 'child' && !raced) {
          raced = true;
          await otherWorker.updateWorkflowState({
            workflowName: 'child',
            runId: args.runId,
            opts: { status: raceStatus },
          });
          // Prove the real store rejects the stale conditional write.
          expect(await original(args)).toBeUndefined();
        }
        return original(args);
      };

      const result = await (await processB.getWorkflow('parent').createRun({ runId: run.runId })).cancel();
      expect(result.failed).toEqual([]);
      expect((await store.loadWorkflowSnapshot({ workflowName: 'child', runId: run.runId }))?.status).toBe(expected);
    },
  );
});
