/**
 * Aborting a workflow tool must cancel the workflow run it started (#29890).
 *
 * The `workflow-<key>` tool used to ignore its `abortSignal`, so aborting the
 * agent call or cancelling the background task reported the tool as cancelled
 * while the workflow kept running every remaining step.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
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
  let generateCall = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      usage,
      ...(generateCall++ === 0
        ? {
            finishReason: 'tool-calls' as const,
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: 'call-1',
                toolName: 'workflow-review',
                input: JSON.stringify({ inputData: { count: TOTAL } }),
              },
            ],
          }
        : { finishReason: 'stop' as const, content: [{ type: 'text' as const, text: 'ok' }] }),
    }),
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

function trackSetup(agent: Agent, review: ReturnType<typeof createReviewWorkflow>['review']) {
  const createRunSpy = vi.spyOn(review, 'createRun');
  const trackSpy = vi.spyOn((agent as any).logger, 'trackException');
  const runStatus = async () => {
    const runId = createRunSpy.mock.calls[0]?.[0]?.runId;
    expect(runId).toBeTruthy();
    return (await review.getWorkflowRunById(runId!))?.status;
  };
  const trackedWorkflowFailure = () =>
    trackSpy.mock.calls.some(([error]: any[]) => error?.id === 'AGENT_WORKFLOW_TOOL_EXECUTION_FAILED');
  return { createRunSpy, runStatus, trackedWorkflowFailure };
}

describe('workflow tool abort (#29890)', () => {
  it.each(['stream', 'generate'] as const)(
    'cancels the workflow run when the agent %s call is aborted',
    async method => {
      const { review, progress } = createReviewWorkflow();
      const agent = new Agent({
        id: 'abort-agent',
        name: 'Abort Agent',
        instructions: 'Review items',
        model: workflowCallThenAnswerModel() as LanguageModelV2,
        workflows: { review },
      });
      new Mastra({ logger: false, storage: new MockStore(), agents: { agent } });
      const { runStatus, trackedWorkflowFailure } = trackSetup(agent, review);

      const controller = new AbortController();
      const done =
        method === 'stream'
          ? agent.stream('review', { abortSignal: controller.signal }).then(output => output.consumeStream())
          : agent.generate('review', { abortSignal: controller.signal });
      const settled = done.catch(() => {});

      await waitFor(() => progress.itemsDone >= 5);
      controller.abort();
      const itemsAtAbort = progress.itemsDone;
      await settled;
      await waitFor(async () => (await runStatus()) === 'canceled');
      await sleep(ITEM_MS * 5);

      expect(progress.itemsDone).toBeLessThanOrEqual(itemsAtAbort + 1);
      expect(trackedWorkflowFailure()).toBe(false);
    },
  );

  it('cancels a run created while the call was being aborted', async () => {
    const { review, progress } = createReviewWorkflow();
    const agent = new Agent({
      id: 'race-agent',
      name: 'Race Agent',
      instructions: 'Review items',
      model: workflowCallThenAnswerModel() as LanguageModelV2,
      workflows: { review },
    });
    new Mastra({ logger: false, storage: new MockStore(), agents: { agent } });
    const { createRunSpy, runStatus, trackedWorkflowFailure } = trackSetup(agent, review);

    const controller = new AbortController();
    const createRun = review.createRun.bind(review);
    createRunSpy.mockImplementationOnce(async options => {
      const run = await createRun(options);
      controller.abort();
      return run;
    });

    await agent
      .stream('review', { abortSignal: controller.signal })
      .then(output => output.consumeStream())
      .catch(() => {});
    await sleep(ITEM_MS * 5);

    expect(await runStatus()).toBe('canceled');
    expect(progress.itemsDone).toBe(0);
    expect(trackedWorkflowFailure()).toBe(false);
  });

  it.each(['cancel', 'timeout'] as const)('cancels the workflow run when its background task hits %s', async how => {
    const { review, progress } = createReviewWorkflow();
    const timeoutMs = how === 'timeout' ? ITEM_MS * 5 : 60_000;
    const agent = new Agent({
      id: 'bg-abort-agent',
      name: 'BG Abort Agent',
      instructions: 'Review items',
      model: workflowCallThenAnswerModel() as LanguageModelV2,
      workflows: { review },
      memory: new MockMemory(),
      backgroundTasks: { tools: { review: { enabled: true, timeoutMs } } },
    });
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      backgroundTasks: { enabled: true },
      agents: { agent },
    });
    const { runStatus } = trackSetup(agent, review);
    await mastra.startWorkers();

    try {
      const memory = { thread: 'thread-1', resource: 'resource-1' };
      await (await agent.stream('review', { memory })).consumeStream();
      const manager = mastra.backgroundTaskManager!;
      const findTask = async () =>
        (await manager.listTasks({ threadId: memory.thread })).tasks.find(t => t.toolName === 'workflow-review');

      await waitFor(() => progress.itemsDone >= 2);
      const task = (await findTask())!;
      expect(task).toBeDefined();
      if (how === 'cancel') await manager.cancel(task.id);
      await waitFor(async () => (await runStatus()) === 'canceled');
      const itemsAtCancel = progress.itemsDone;
      await sleep(ITEM_MS * 5);

      expect((await manager.getTask(task.id))?.status).toBe(how === 'cancel' ? 'cancelled' : 'timed_out');
      expect(progress.itemsDone).toBeLessThanOrEqual(itemsAtCancel + 1);
      expect(progress.itemsDone).toBeLessThan(TOTAL);
    } finally {
      await mastra.backgroundTaskManager?.shutdown();
    }
  });
});
