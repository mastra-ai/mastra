/**
 * At its `modelSettings.timeout.totalMs` deadline the caller deletes the run's snapshot. A worker
 * whose final write is still in flight must not bring the run back, whichever order the delete and
 * that write reach storage in.
 *
 * The run finishes just before the deadline, and its finish hooks hold the worker's final write
 * past it while the caller's timer still fires. The test then holds the delete until that write has
 * started, and the write until the delete has finished, so the write lands on the deleted row.
 */
import { Agent } from '@mastra/core/agent';
import { CachingPubSub } from '@mastra/core/events';
import { simulateReadableStream } from 'ai';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createInngestAgent } from '../durable-agent';

import { createInngestDurableAgenticWorkflow } from '../durable-agent/create-inngest-agentic-workflow';
import type { InngestWorkflow } from '../workflow';
import {
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 90_000 });

const TOTAL_MS = 4000;
/** The model answers this long before the deadline, so the run finishes but the caller's timer stays armed. */
const ANSWER_MARGIN_MS = 1000;
/** The worker's finish hook holds its final write this long, so it starts after the deadline. */
const WORKER_FINISH_HOLD_MS = 1500;
/** The caller's finish hook holds the run's settlement, so the deadline timer fires first. */
const CALLER_FINISH_HOLD_MS = 2500;

const workflow = createInngestDurableAgenticWorkflow({ inngest: getSharedInngest() });
workflow.options.onFinish = async () => {
  await new Promise(resolve => setTimeout(resolve, WORKER_FINISH_HOLD_MS));
};
(workflow as unknown as InngestWorkflow).__setPubsubFactory(
  base =>
    new CachingPubSub(base, getSharedMastra().serverCache, {
      shouldCache: topic => topic.startsWith('agent.stream.'),
    }),
);

beforeAll(() => setupSharedTestInfrastructure({ workflows: { [workflow.id]: workflow } }));
afterAll(() => teardownSharedTestInfrastructure({ forceClose: true }));

/** Answers `done` once the deadline is `ANSWER_MARGIN_MS` away. */
function answerNearDeadline(deadline: () => number): any {
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'mock-model',
    supportedUrls: {},
    async doStream() {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, deadline() - ANSWER_MARGIN_MS - Date.now())));
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'done', modelId: 'mock-model', timestamp: new Date(0) },
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'done' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ] as any,
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}

it.each([1, 2, 3])(
  'a final write that lands after the deadline deletion leaves the run deleted (attempt %i)',
  async attempt => {
    const store = (await getSharedMastra().getStorage()!.getStore('workflows'))!;
    const originalDelete = store.deleteWorkflowRunById.bind(store);
    const originalPersist = store.persistWorkflowSnapshot.bind(store);
    const originalUpdate = store.updateWorkflowState.bind(store);
    let deadlineAt = 0;
    let runId = '';
    let deletingAt = 0;
    let deletedAt = 0;
    let writingAt = 0;
    let writtenAt = 0;
    let releaseWriteStarted!: () => void;
    let releaseDeleted!: () => void;
    const writeStarted = new Promise<void>(resolve => (releaseWriteStarted = resolve));
    const deleted = new Promise<void>(resolve => (releaseDeleted = resolve));
    const isThisRun = (params: { runId: string; workflowName: string }) =>
      params.runId === runId && params.workflowName === workflow.id;

    const deletion = vi.spyOn(store, 'deleteWorkflowRunById').mockImplementation(async params => {
      if (isThisRun(params)) {
        deletingAt = Date.now();
        await Promise.race([writeStarted, new Promise(resolve => setTimeout(resolve, 2000))]);
      }
      await originalDelete(params);
      if (isThisRun(params)) {
        deletedAt = Date.now();
        releaseDeleted();
      }
    });
    /** The worker's final write, by whichever store method the engine issues it. */
    const holdLateWrite = async <T>(
      params: { runId: string; workflowName: string },
      status: string,
      write: () => Promise<T>,
    ) => {
      const late = isThisRun(params) && status === 'success' && Date.now() >= deadlineAt && deletingAt > 0;
      if (late) {
        writingAt = Date.now();
        releaseWriteStarted();
        await deleted;
      }
      const value = await write();
      if (late) writtenAt = Date.now();
      return value;
    };
    const persistence = vi
      .spyOn(store, 'persistWorkflowSnapshot')
      .mockImplementation(params => holdLateWrite(params, params.snapshot.status, () => originalPersist(params)));
    const update = vi
      .spyOn(store, 'updateWorkflowState')
      .mockImplementation(params => holdLateWrite(params, params.opts.status, () => originalUpdate(params)));

    const agent = createInngestAgent({
      agent: new Agent({
        id: `deletion-race-${attempt}`,
        name: 'Deletion race',
        instructions: 'Answer done',
        model: answerNearDeadline(() => deadlineAt),
      }),
      inngest: getSharedInngest(),
    });
    getSharedMastra().addAgent(agent);
    // Cleanup clears the caller's deadline timer, so it waits until the race has played out.
    let cleanup = () => {};
    try {
      const startedAt = Date.now();
      deadlineAt = startedAt + TOTAL_MS;
      const result = await agent.stream('Answer done', {
        modelSettings: { timeout: { totalMs: TOTAL_MS } },
        onFinish: async () => {
          await new Promise(resolve => setTimeout(resolve, CALLER_FINISH_HOLD_MS));
        },
      });
      runId = result.runId;
      cleanup = result.cleanup;
      const types: string[] = [];
      for await (const chunk of result.output.fullStream) types.push(chunk.type);
      const finishedAt = Date.now();
      expect(types).toContain('finish');
      expect(finishedAt, 'the run must finish before its deadline').toBeLessThan(deadlineAt);

      await vi.waitFor(() => expect(deletedAt, 'the caller deletes the run at its deadline').toBeGreaterThan(0), {
        timeout: 8000,
      });
      await vi.waitFor(
        () => expect(writtenAt, "the worker's final write lands after the deadline").toBeGreaterThan(0),
        {
          timeout: 8000,
        },
      );
      const snapshot = await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId });
      console.log(
        'DELETE_RACE',
        JSON.stringify({
          attempt,
          finishMs: finishedAt - startedAt,
          deadlineMs: TOTAL_MS,
          deleteStartMs: deletingAt - startedAt,
          deletedMs: deletedAt - startedAt,
          writeStartMs: writingAt - startedAt,
          writtenMs: writtenAt - startedAt,
          status: snapshot?.status ?? null,
        }),
      );
      expect(writtenAt, 'the late write must land after the delete').toBeGreaterThanOrEqual(deletedAt);
      expect(snapshot, 'a run the caller deleted stays deleted').toBeNull();
    } finally {
      cleanup();
      update.mockRestore();
      persistence.mockRestore();
      deletion.mockRestore();
      releaseWriteStarted();
      releaseDeleted();
    }
  },
);
