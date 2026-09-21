import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { pruneAgentLoopSnapshot } from '../loop/workflows/prune-snapshot';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';
import { createWorkflow } from './create';
import type { WorkflowRunState } from './types';
import { createStep } from './workflow';

describe('restart at a completed step boundary', () => {
  it.each(['loop', 'foreach', 'parallel', 'conditional'] as const)(
    'does not repeat a completed %s on restart',
    async kind => {
      const effect = vi.fn(async () => ({ messageListState: { messages: ['retained'] }, receipt: 'one-effect' }));
      const makeWorkflow = () => {
        const workflow = createWorkflow({
          id: 'loop-boundary',
          inputSchema: z.any(),
          outputSchema: z.any(),
          options: { pruneSnapshot: pruneAgentLoopSnapshot, reuseCompletedStepCheckpoint: true },
        });
        const effectStep = createStep({ id: 'effect', inputSchema: z.any(), outputSchema: z.any(), execute: effect });
        const chain =
          kind === 'loop'
            ? workflow.dowhile(effectStep, async () => false)
            : kind === 'foreach'
              ? workflow.foreach(effectStep)
              : kind === 'parallel'
                ? workflow.parallel([effectStep])
                : workflow.branch([[async () => true, effectStep]]);
        return chain
          .then(
            createStep({
              id: 'following',
              inputSchema: z.any(),
              outputSchema: z.any(),
              execute: async ({ inputData }) => inputData,
            }),
          )
          .commit();
      };
      const storage = new InMemoryStore();
      const workflow = makeWorkflow();
      const mastra = new Mastra({ logger: false, storage, workflows: { workflow } });
      const workflows = (await storage.getStore('workflows'))!;
      const persist = workflows.persistWorkflowSnapshot.bind(workflows);
      let checkpoint: WorkflowRunState | undefined;
      vi.spyOn(workflows, 'persistWorkflowSnapshot').mockImplementation(async args => {
        await persist(args);
        if (
          args.snapshot.status === 'running' &&
          args.snapshot.context.effect?.status === 'success' &&
          !args.snapshot.context.following
        )
          checkpoint = structuredClone(args.snapshot);
      });
      try {
        await (
          await workflow.createRun({ runId: 'loop-original' })
        ).start({ inputData: kind === 'foreach' ? [{}] : {} });
        expect(checkpoint).toBeDefined();
        const recoveredStorage = new InMemoryStore();
        const recoveredWorkflow = makeWorkflow();
        const recovered = new Mastra({ logger: false, storage: recoveredStorage, workflows: { recoveredWorkflow } });
        try {
          await (await recoveredStorage.getStore('workflows'))!.persistWorkflowSnapshot({
            workflowName: workflow.id,
            runId: 'loop-original',
            snapshot: checkpoint!,
          });
          const result = await (await recoveredWorkflow.createRun({ runId: 'loop-original' })).restart();
          expect(result.status).toBe('success');
          expect(effect).toHaveBeenCalledTimes(1);
          const output = { messageListState: { messages: ['retained'] }, receipt: 'one-effect' };
          expect(result.result).toEqual(kind === 'loop' ? output : kind === 'foreach' ? [output] : { effect: output });
        } finally {
          await recovered.shutdown();
        }
      } finally {
        await mastra.shutdown();
      }
    },
  );
  it.each([false, true])('retains the completed result without repeating its effect (reuse=%s)', async reuse => {
    const effect = vi.fn(async () => ({
      messageListState: { messages: ['paid response'] },
      accumulatedSteps: [{ text: 'paid response' }],
      receipt: 'one-charge',
    }));
    const makeWorkflow = () =>
      createWorkflow({
        id: 'completed-boundary',
        inputSchema: z.any(),
        outputSchema: z.any(),
        options: {
          shouldPersistSnapshot: () => true,
          pruneSnapshot: pruneAgentLoopSnapshot,
          reuseCompletedStepCheckpoint: reuse,
        },
      })
        .then(
          createStep({
            id: 'effect',
            inputSchema: z.any(),
            outputSchema: z.any(),
            execute: effect,
          }),
        )
        .then(
          createStep({
            id: 'following',
            inputSchema: z.any(),
            outputSchema: z.any(),
            execute: async ({ inputData }) => inputData,
          }),
        )
        .commit();
    const storage = new InMemoryStore();
    const workflow = makeWorkflow();
    const mastra = new Mastra({ logger: false, storage, workflows: { workflow } });
    const workflows = (await storage.getStore('workflows'))!;
    const originalPersist = workflows.persistWorkflowSnapshot.bind(workflows);
    let checkpoint: WorkflowRunState | undefined;
    vi.spyOn(workflows, 'persistWorkflowSnapshot').mockImplementation(async args => {
      await originalPersist(args);
      if (
        args.snapshot.status === 'running' &&
        args.snapshot.context.effect?.status === 'success' &&
        !args.snapshot.context.following
      ) {
        checkpoint = structuredClone(args.snapshot);
      }
    });
    try {
      const run = await workflow.createRun({ runId: 'original' });
      expect((await run.start({ inputData: { prompt: 'question' } })).status).toBe('success');
      expect(checkpoint).toBeDefined();
      // Replay the actual stored boundary, as a fresh process would see it.
      const recoveredStore = new InMemoryStore();
      const recoveredWorkflow = makeWorkflow();
      const recoveredMastra = new Mastra({ logger: false, storage: recoveredStore, workflows: { recoveredWorkflow } });
      try {
        await (await recoveredStore.getStore('workflows'))!.persistWorkflowSnapshot({
          workflowName: workflow.id,
          runId: 'original',
          snapshot: checkpoint!,
        });
        const recoveredRun = await recoveredWorkflow.createRun({ runId: 'original' });
        const result = await recoveredRun.restart();
        expect(result.status).toBe('success');
        expect(effect).toHaveBeenCalledTimes(1);
        expect(result.result).toEqual({
          messageListState: { messages: ['paid response'] },
          accumulatedSteps: [{ text: 'paid response' }],
          receipt: 'one-charge',
        });
      } finally {
        await recoveredMastra.shutdown();
      }
    } finally {
      await mastra.shutdown();
    }
  });
});
