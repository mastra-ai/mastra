import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow as createDefaultWorkflow } from './create';
import { createWorkflow as createEventedWorkflow } from './evented';
import { createStep } from './workflow';

const engines = [
  { name: 'default', createWorkflow: createDefaultWorkflow },
  { name: 'evented', createWorkflow: createEventedWorkflow },
] as const;

describe.each(engines)('foreach partial progress ($name engine)', ({ name, createWorkflow }) => {
  let mastra: Mastra | undefined;

  afterEach(async () => {
    await mastra?.stopWorkers();
    mastra = undefined;
  });

  it('reports running without exposing incomplete output until all items finish', async () => {
    const item = z.object({ n: z.number() });
    const release: Record<number, () => void> = {};
    const started = new Set<number>();
    let firstFinished!: () => void;
    const firstFinishedPromise = new Promise<void>(resolve => (firstFinished = resolve));
    const list = createStep({
      id: 'list',
      inputSchema: z.object({}),
      outputSchema: z.array(item),
      execute: async () => [{ n: 1 }, { n: 2 }],
    });
    const slow = createStep({
      id: 'slow',
      inputSchema: item,
      outputSchema: item,
      execute: async ({ inputData }) => {
        started.add(inputData.n);
        await new Promise<void>(resolve => (release[inputData.n] = resolve));
        if (inputData.n === 1) firstFinished();
        return inputData;
      },
    });
    const workflow = createWorkflow({
      id: `foreach-partial-${name}`,
      inputSchema: z.object({}),
      outputSchema: z.array(item),
    })
      .then(list)
      .foreach(slow, { concurrency: 2 })
      .commit();
    mastra = new Mastra({
      workflows: { [workflow.id]: workflow },
      storage: new MockStore(),
      pubsub: name === 'evented' ? new EventEmitterPubSub() : undefined,
      logger: false,
    });
    if (name === 'evented') await mastra.startWorkers();

    const run = await workflow.createRun();
    const resultPromise = run.start({ inputData: {} });
    await vi.waitFor(() => expect(started.size).toBe(2), { timeout: 5000 });

    const expectRunning = async () => {
      const state = await workflow.getWorkflowRunById(run.runId);
      expect(state?.steps.slow?.status).toBe('running');
      expect(state?.steps.slow?.endedAt).toBeUndefined();
      expect(state?.steps.slow?.output).toBeUndefined();
    };
    await vi.waitFor(expectRunning, { timeout: 5000 });

    release[1]!();
    await firstFinishedPromise;
    if (name === 'evented') {
      const store = (await mastra.getStorage()!.getStore('workflows'))!;
      await vi.waitFor(
        async () => {
          const snapshot = await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
          expect((snapshot?.context as Record<string, any> | undefined)?.slow?.output?.[0]).toEqual({ n: 1 });
        },
        { timeout: 5000 },
      );
    }
    await expectRunning();

    release[2]!();
    const result = await resultPromise;
    expect(result.status).toBe('success');
    const state = await workflow.getWorkflowRunById(run.runId);
    expect(state?.steps.slow?.status).toBe('success');
    expect(state?.steps.slow?.output).toEqual([{ n: 1 }, { n: 2 }]);
    expect(state?.steps.slow?.endedAt).toBeTypeOf('number');
  });

  it('does not end a suspended foreach while a sibling finishes', async () => {
    const item = z.object({ n: z.number() });
    let releaseSibling!: () => void;
    const siblingBlocked = new Promise<void>(resolve => (releaseSibling = resolve));
    let siblingEntered!: () => void;
    const siblingEnteredPromise = new Promise<void>(resolve => (siblingEntered = resolve));
    const list = createStep({
      id: 'list',
      inputSchema: z.object({}),
      outputSchema: z.array(item),
      execute: async () => [{ n: 1 }, { n: 2 }],
    });
    const slow = createStep({
      id: 'slow',
      inputSchema: item,
      outputSchema: item,
      resumeSchema: z.object({ ok: z.boolean() }),
      execute: async ({ inputData, suspend, resumeData }) => {
        if (inputData.n === 1) return resumeData ? inputData : await suspend({});
        siblingEntered();
        await siblingBlocked;
        return inputData;
      },
    });
    const workflow = createWorkflow({
      id: `foreach-suspend-${name}`,
      inputSchema: z.object({}),
      outputSchema: z.array(item),
    })
      .then(list)
      .foreach(slow, { concurrency: 2 })
      .commit();
    mastra = new Mastra({
      workflows: { [workflow.id]: workflow },
      storage: new MockStore(),
      pubsub: name === 'evented' ? new EventEmitterPubSub() : undefined,
      logger: false,
    });
    if (name === 'evented') await mastra.startWorkers();

    const run = await workflow.createRun();
    const resultPromise = run.start({ inputData: {} });
    await siblingEnteredPromise;
    const store = (await mastra.getStorage()!.getStore('workflows'))!;
    if (name === 'evented') {
      await vi.waitFor(
        async () => {
          const snapshot = await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
          expect((snapshot?.context as Record<string, any> | undefined)?.slow?.output?.[0]?.status).toBe('suspended');
        },
        { timeout: 5000 },
      );
    }
    const running = await workflow.getWorkflowRunById(run.runId);
    expect(running?.steps.slow?.status).toBe('running');
    expect(running?.steps.slow?.endedAt).toBeUndefined();
    releaseSibling();

    const result = await resultPromise;
    expect(result.status).toBe('suspended');
    const suspended = await workflow.getWorkflowRunById(run.runId);
    expect(suspended?.steps.slow?.status).toBe('suspended');
    expect(suspended?.steps.slow?.endedAt).toBeUndefined();

    const resumed = await run.resume({ step: 'slow', resumeData: { ok: true }, forEachIndex: 0 });
    expect(resumed.status).toBe('success');
    const final = await workflow.getWorkflowRunById(run.runId);
    expect(final?.steps.slow?.status).toBe('success');
    expect(final?.steps.slow?.output).toEqual([{ n: 1 }, { n: 2 }]);
    expect(final?.steps.slow?.endedAt).toBeTypeOf('number');
  });
});
