/**
 * Aborting a workflow tool must cancel the workflow run it started (#29890).
 *
 * The `workflow-<key>` tool used to ignore its `abortSignal`, so aborting the
 * agent call or cancelling the background task reported the tool as cancelled
 * while the workflow kept running every remaining step.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';

const TOTAL = 30;
const ITEM_MS = 20;
const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function workflowCallThenAnswerModel() {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream(
        call++ === 0
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'workflow-review',
                input: JSON.stringify({ inputData: { count: TOTAL } }),
                providerExecuted: false,
              },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'ok' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage },
            ],
      ),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

function createReviewWorkflow() {
  const progress = { itemsDone: 0 };
  const item = z.object({ i: z.number() });
  const work = createStep({
    id: 'work',
    inputSchema: item,
    outputSchema: item,
    execute: async ({ inputData }) => {
      await new Promise(r => setTimeout(r, ITEM_MS));
      progress.itemsDone++;
      return inputData;
    },
  });
  const review = createWorkflow({
    id: 'review',
    inputSchema: z.object({ count: z.number() }),
    outputSchema: z.array(item),
  })
    .map(async ({ inputData }) => Array.from({ length: inputData.count }, (_, i) => ({ i })))
    .foreach(work, { concurrency: 1 })
    .commit();
  return { review, progress };
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function waitFor(cond: () => boolean | Promise<boolean>, timeoutMs = 5000) {
  const start = Date.now();
  while (!(await cond())) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition');
    await sleep(5);
  }
}

describe('workflow tool abort (#29890)', () => {
  it('cancels the workflow run when the agent call is aborted', async () => {
    const { review, progress } = createReviewWorkflow();
    const agent = new Agent({
      id: 'abort-agent',
      name: 'Abort Agent',
      instructions: 'Review items',
      model: workflowCallThenAnswerModel() as LanguageModelV2,
      workflows: { review },
    });
    new Mastra({ logger: false, storage: new MockStore(), agents: { agent } });

    const controller = new AbortController();
    const output = await agent.stream('review', { abortSignal: controller.signal });
    const consumed = output.consumeStream().catch(() => {});

    await waitFor(() => progress.itemsDone >= 5);
    controller.abort();
    const itemsAtAbort = progress.itemsDone;
    await consumed;
    await sleep(ITEM_MS * 10);

    expect(progress.itemsDone).toBeLessThanOrEqual(itemsAtAbort + 1);
  });

  it('cancels the workflow run when its background task is cancelled', async () => {
    const { review, progress } = createReviewWorkflow();
    const agent = new Agent({
      id: 'bg-abort-agent',
      name: 'BG Abort Agent',
      instructions: 'Review items',
      model: workflowCallThenAnswerModel() as LanguageModelV2,
      workflows: { review },
      memory: new MockMemory(),
      backgroundTasks: { tools: { review: { enabled: true, timeoutMs: 60_000 } } },
    });
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
      agents: { agent },
    });
    await mastra.startWorkers();

    try {
      const memory = { thread: 'thread-1', resource: 'resource-1' };
      await (await agent.stream('review', { memory })).consumeStream();

      await waitFor(() => progress.itemsDone >= 5);
      const manager = mastra.backgroundTaskManager!;
      const { tasks } = await manager.listTasks({ threadId: memory.thread });
      const task = tasks.find(t => t.toolName === 'workflow-review')!;
      expect(task).toBeDefined();

      await manager.cancel(task.id);
      const itemsAtCancel = progress.itemsDone;
      await sleep(ITEM_MS * 10);

      expect((await manager.getTask(task.id))?.status).toBe('cancelled');
      expect(progress.itemsDone).toBeLessThanOrEqual(itemsAtCancel + 1);
    } finally {
      await mastra.backgroundTaskManager?.shutdown();
    }
  });
});
