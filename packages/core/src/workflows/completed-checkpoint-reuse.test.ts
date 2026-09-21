import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RequestContext } from '../di';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { createWorkflow } from './create';
import { DefaultExecutionEngine } from './default';
import type { PersistStepUpdateParams } from './handlers/entry';
import type { WorkflowRunState } from './types';
import { createStep } from './workflow';

describe('completed checkpoint reuse', () => {
  it.each(['buffer', 'custom-json', 'non-cloneable'])(
    'preserves storage encoding and keeps start writes for %s values',
    async kind => {
      class Receipt {
        toJSON() {
          return { receipt: 'saved-receipt' };
        }
      }
      const output = {
        value:
          kind === 'buffer'
            ? Buffer.from('receipt')
            : kind === 'custom-json'
              ? new Receipt()
              : { receipt: 'saved-receipt', ignoredByJson: () => undefined },
      };
      const expected = JSON.parse(JSON.stringify(output));
      const storage = new InMemoryStore();
      const workflows = (await storage.getStore('workflows'))!;
      const persist = workflows.persistWorkflowSnapshot.bind(workflows);
      const writes: WorkflowRunState[] = [];
      vi.spyOn(workflows, 'persistWorkflowSnapshot').mockImplementation(async args => {
        writes.push(JSON.parse(JSON.stringify(args.snapshot)));
        await persist(args);
      });
      const workflow = createWorkflow({
        id: `encoding-${kind}`,
        inputSchema: z.any(),
        outputSchema: z.any(),
        options: { reuseCompletedStepCheckpoint: true },
      })
        .then(createStep({ id: 'first', inputSchema: z.any(), outputSchema: z.any(), execute: async () => output }))
        .then(
          createStep({
            id: 'second',
            inputSchema: z.any(),
            outputSchema: z.any(),
            execute: async ({ inputData }) => inputData,
          }),
        )
        .commit();
      const mastra = new Mastra({ logger: false, storage, workflows: { workflow } });
      try {
        expect((await (await workflow.createRun()).start({ inputData: {} })).status).toBe('success');
        const completed = writes.find(s => s.completedEntry && s.context.first?.status === 'success')!;
        expect(completed.context.first).toMatchObject({ output: expected });
        expect(completed.preparedNextStep).toBeUndefined();
        expect(writes.some(s => s.context.second?.status === 'running')).toBe(true);
      } finally {
        await mastra.shutdown();
      }
    },
  );

  it.each(
    ['state', 'context', 'output'].flatMap(field =>
      ['before-serialization', 'after-serialization'].map(timing => ({ field, timing })),
    ),
  )('persists live $field changes during storage I/O ($timing)', async ({ field, timing }) => {
    const state = { nested: { revision: 0 } };
    const context = { nested: { revision: 0 } };
    const output = { nested: { revision: 0 } };
    const target = field === 'state' ? state : field === 'context' ? context : output;
    const requestContext = new RequestContext();
    requestContext.set('tenant', context);
    const writes: WorkflowRunState[] = [];
    const engine = new DefaultExecutionEngine({
      mastra: {
        getStorage: () => ({
          getStore: async () => ({
            persistWorkflowSnapshot: async ({ snapshot }: { snapshot: WorkflowRunState }) => {
              if (timing === 'before-serialization') {
                await Promise.resolve();
                target.nested.revision = 1;
              }
              writes.push(JSON.parse(JSON.stringify(snapshot)));
              if (timing === 'after-serialization') {
                await Promise.resolve();
                target.nested.revision = 1;
              }
            },
          }),
        }),
      } as any,
      options: { validateInputs: false, shouldPersistSnapshot: () => true, reuseCompletedStepCheckpoint: true },
    });
    const params = {
      workflowId: 'mutation',
      runId: 'mutation-run',
      workflowStatus: 'running',
      requestContext,
      serializedStepGraph: [
        { type: 'step', step: { id: 'first' } },
        { type: 'step', step: { id: 'second' } },
      ],
      stepResults: { first: { status: 'success', output } },
      executionContext: {
        workflowId: 'mutation',
        runId: 'mutation-run',
        executionPath: [0],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        retryConfig: { attempts: 0, delay: 0 },
        state,
      },
      phase: 'entry-end',
    } as PersistStepUpdateParams;
    await engine.persistStepUpdate(params);
    await engine.persistStepUpdate({
      ...params,
      phase: 'start',
      stepResults: { ...params.stepResults, second: { status: 'running', payload: output, startedAt: Date.now() } },
      executionContext: { ...params.executionContext, executionPath: [1], activeStepsPath: { second: [1] } },
    });
    expect(writes).toHaveLength(2);
    const retained = (snapshot: WorkflowRunState) =>
      field === 'state'
        ? snapshot.value
        : field === 'context'
          ? snapshot.requestContext?.tenant
          : snapshot.context.first?.output;
    expect(retained(writes[0]!)).toEqual({ nested: { revision: 0 } });
    expect(retained(writes[1]!)).toEqual({ nested: { revision: 1 } });
  });

  it('preserves restart:true when a crash interrupts the step after a reused checkpoint', async () => {
    let entered!: () => void;
    const started = new Promise<void>(resolve => {
      entered = resolve;
    });
    let release!: () => void;
    const parked = new Promise<void>(resolve => {
      release = resolve;
    });
    let effects = 0;
    const restartFlags: boolean[] = [];
    const makeWorkflow = (recovering: boolean) =>
      createWorkflow({
        id: 'restart-intent',
        inputSchema: z.any(),
        outputSchema: z.any(),
        options: { reuseCompletedStepCheckpoint: true },
      })
        .then(
          createStep({
            id: 'prepare',
            inputSchema: z.any(),
            outputSchema: z.any(),
            execute: async () => ({ receipt: 'same-operation' }),
          }),
        )
        .then(
          createStep({
            id: 'effect',
            inputSchema: z.any(),
            outputSchema: z.any(),
            execute: async ({ inputData, restart }) => {
              restartFlags.push(restart);
              if (!restart) effects++;
              if (!recovering) {
                entered();
                await parked;
              }
              return inputData;
            },
          }),
        )
        .commit();
    const storage = new InMemoryStore();
    const workflows = (await storage.getStore('workflows'))!;
    const persist = workflows.persistWorkflowSnapshot.bind(workflows);
    let lastSnapshot: WorkflowRunState | undefined;
    vi.spyOn(workflows, 'persistWorkflowSnapshot').mockImplementation(async args => {
      await persist(args);
      lastSnapshot = structuredClone(args.snapshot);
    });
    const workflow = makeWorkflow(false);
    const mastra = new Mastra({ logger: false, storage, workflows: { workflow } });
    let original: Promise<unknown> | undefined;
    try {
      original = (await workflow.createRun({ runId: 'interrupted' })).start({ inputData: {} });
      await started;
      const interrupted = structuredClone(lastSnapshot!);
      expect(interrupted.preparedNextStep).toBe('effect');
      const recoveredStorage = new InMemoryStore();
      const recoveredWorkflow = makeWorkflow(true);
      const recovered = new Mastra({ logger: false, storage: recoveredStorage, workflows: { recoveredWorkflow } });
      try {
        await (await recoveredStorage.getStore('workflows'))!.persistWorkflowSnapshot({
          workflowName: workflow.id,
          runId: 'interrupted',
          snapshot: interrupted,
        });
        const result = await (await recoveredWorkflow.createRun({ runId: 'interrupted' })).restart();
        expect(result.result).toEqual({ receipt: 'same-operation' });
        expect(restartFlags).toEqual([false, true]);
        expect(effects).toBe(1);
      } finally {
        await recovered.shutdown();
      }
    } finally {
      release();
      await original;
      await mastra.shutdown();
    }
  });
  it('keeps overlapping runs and their retained inputs separate', async () => {
    const storage = new InMemoryStore();
    const workflows = (await storage.getStore('workflows'))!;
    const persist = workflows.persistWorkflowSnapshot.bind(workflows);
    const writes = new Map<string, WorkflowRunState[]>();
    vi.spyOn(workflows, 'persistWorkflowSnapshot').mockImplementation(async args => {
      await new Promise(resolve => setTimeout(resolve, 2));
      await persist(args);
      const records = writes.get(args.runId) ?? [];
      records.push(structuredClone(args.snapshot));
      writes.set(args.runId, records);
    });
    const step = (id: string) =>
      createStep({
        id,
        inputSchema: z.any(),
        outputSchema: z.any(),
        execute: async ({ inputData }) => ({ ...inputData, [id]: true }),
      });
    const workflow = createWorkflow({
      id: 'overlapping-checkpoints',
      inputSchema: z.any(),
      outputSchema: z.any(),
      options: { reuseCompletedStepCheckpoint: true },
    })
      .then(step('first'))
      .then(step('second'))
      .commit();
    const mastra = new Mastra({ logger: false, storage, workflows: { workflow } });
    try {
      await Promise.all(
        Array.from({ length: 6 }, async (_, index) => {
          const runId = `run-${index}`;
          const result = await (await workflow.createRun({ runId })).start({ inputData: { owner: runId } });
          expect(result.result).toEqual({ owner: runId, first: true, second: true });
          const snapshots = writes.get(runId)!;
          expect(snapshots.some(s => s.context.first?.status === 'success')).toBe(true);
          expect(snapshots.some(s => s.context.second?.status === 'running')).toBe(false);
          for (const snapshot of snapshots.filter(s => s.context.input))
            expect(snapshot.context.input?.owner).toBe(runId);
        }),
      );
    } finally {
      await mastra.shutdown();
    }
  });
  it.each([false, true])('persists every result with reuse=%s', async reuse => {
    const storage = new InMemoryStore();
    const writes: WorkflowRunState[] = [];
    const workflows = (await storage.getStore('workflows'))!;
    const persist = workflows.persistWorkflowSnapshot.bind(workflows);
    vi.spyOn(workflows, 'persistWorkflowSnapshot').mockImplementation(async args => {
      writes.push(structuredClone(args.snapshot));
      await persist(args);
    });
    const seen: string[] = [];
    const step = (id: string) =>
      createStep({
        id,
        inputSchema: z.any(),
        outputSchema: z.any(),
        execute: async ({ inputData }) => {
          // A preceding side effect must have an acknowledged completion record
          // before the next side effect is allowed to start.
          if (seen.length) expect(writes.some(s => s.context[seen.at(-1)!]?.status === 'success')).toBe(true);
          seen.push(id);
          return { ...inputData, [id]: true };
        },
      });
    const workflow = createWorkflow({
      id: 'checkpoint-reuse',
      inputSchema: z.any(),
      outputSchema: z.any(),
      options: { reuseCompletedStepCheckpoint: reuse },
    })
      .then(step('first'))
      .then(step('second'))
      .then(step('third'))
      .commit();
    const mastra = new Mastra({ logger: false, storage, workflows: { workflow } });
    try {
      const result = await (await workflow.createRun()).start({ inputData: {} });
      expect(result.status).toBe('success');
      expect(result.result).toEqual({ first: true, second: true, third: true });
      expect(writes.filter(s => s.status === 'running' && Object.keys(s.activeStepsPath).length)).toHaveLength(
        reuse ? 1 : 3,
      );
      for (const id of seen) expect(writes.some(s => s.context[id]?.status === 'success')).toBe(true);
    } finally {
      await mastra.shutdown();
    }
  });

  it.each(['validation', 'pruning'])('keeps the start checkpoint when %s changes the durable input', async change => {
    const storage = new InMemoryStore();
    const writes: WorkflowRunState[] = [];
    const workflows = (await storage.getStore('workflows'))!;
    const persist = workflows.persistWorkflowSnapshot.bind(workflows);
    vi.spyOn(workflows, 'persistWorkflowSnapshot').mockImplementation(async args => {
      writes.push(structuredClone(args.snapshot));
      await persist(args);
    });
    const workflow = createWorkflow({
      id: `changed-${change}`,
      inputSchema: z.any(),
      outputSchema: z.any(),
      options: {
        reuseCompletedStepCheckpoint: true,
        pruneSnapshot:
          change === 'pruning'
            ? ({ snapshot }) => ({
                ...snapshot,
                context: {
                  ...snapshot.context,
                  ...(snapshot.context.first?.status === 'success'
                    ? { first: { ...snapshot.context.first, output: {} } }
                    : {}),
                },
              })
            : undefined,
      },
    })
      .then(
        createStep({
          id: 'first',
          inputSchema: z.any(),
          outputSchema: z.any(),
          execute: async () => ({ retained: 'value' }),
        }),
      )
      .then(
        createStep({
          id: 'second',
          inputSchema:
            change === 'validation' ? z.object({ retained: z.string(), extra: z.string().default('new') }) : z.any(),
          outputSchema: z.any(),
          execute: async ({ inputData }) => inputData,
        }),
      )
      .commit();
    const mastra = new Mastra({ logger: false, storage, workflows: { workflow } });
    try {
      expect((await (await workflow.createRun()).start({ inputData: {} })).status).toBe('success');
      expect(writes.some(s => s.context.second?.status === 'running')).toBe(true);
    } finally {
      await mastra.shutdown();
    }
  });

  it('does not execute the next side effect when storing the preceding result fails', async () => {
    const storage = new InMemoryStore();
    const workflows = (await storage.getStore('workflows'))!;
    const persist = workflows.persistWorkflowSnapshot.bind(workflows);
    vi.spyOn(workflows, 'persistWorkflowSnapshot').mockImplementation(async args => {
      if (args.snapshot.status === 'running' && args.snapshot.context.first?.status === 'success')
        throw new Error('storage unavailable');
      await persist(args);
    });
    const next = vi.fn(async () => 'unsafe');
    const workflow = createWorkflow({
      id: 'checkpoint-failure',
      inputSchema: z.any(),
      outputSchema: z.any(),
      options: { reuseCompletedStepCheckpoint: true },
    })
      .then(createStep({ id: 'first', inputSchema: z.any(), outputSchema: z.any(), execute: async () => 'receipt' }))
      .then(createStep({ id: 'second', inputSchema: z.any(), outputSchema: z.any(), execute: next }))
      .commit();
    const mastra = new Mastra({ logger: false, storage, workflows: { workflow } });
    try {
      await expect((await workflow.createRun()).start({ inputData: {} })).rejects.toThrow('storage unavailable');
      expect(next).not.toHaveBeenCalled();
    } finally {
      await mastra.shutdown();
    }
  });
});
