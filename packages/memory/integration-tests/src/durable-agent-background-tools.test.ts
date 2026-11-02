/**
 * Port of durable-agent-validation harness case **T4** (`background-tools`) onto the
 * `@internal/llm-recorder`.
 *
 * The harness runs one real-model turn per cell. The prompt asks the model to call
 * `fetchRecord` exactly once with a `_background: { disposition }` override and then reply
 * with the amount the record carries. The case's job is to prove the tool actually ran with
 * the disposition that was asked for, that the tool call and its result reach the transcript
 * exactly once, and that the AI-SDK/Anthropic prefill hazard the harness tracks (F7,
 * COR-1312) stays repaired while background work is in flight.
 *
 * Conditions ported here: `plain`, `durable` and `evented` for the `foreground`, `deferred`
 * and `awaited` variants. Declared differences from the harness, per COR-1443:
 *   - `adopt`: the harness variant where the tool itself calls `context.background.adopt()`.
 *     That process-local handle API is not exposed in-tree yet, so there is nothing to port.
 *   - `evented-redeliver`: owned by the redelivery ticket, not this one.
 *   - `durable-recover`: covered without provider recordings in
 *     `durable-agent-recover-aimock.scenario.test.ts` (COR-1493), including recovery with
 *     running checkpoints enabled and the specific refusal when no checkpoint is available.
 *
 * Like T78, this lives in `packages/memory/integration-tests` because the harness setup needs
 * a real `@mastra/memory` `Memory` over `@mastra/libsql`. Replay is the default: the committed
 * recordings under `packages/memory/__recordings__/` serve every cell without API keys.
 * Re-record with
 *
 *   LLM_TEST_MODE=record pnpm vitest run src/durable-agent-background-tools.test.ts
 *
 * and only commit recordings from an all-pass run. Replay matches requests exactly, so a
 * changed prompt or tool schema reports "No exact match for hash" and needs a re-record.
 */
import { randomUUID } from 'node:crypto';
import { getLLMTestMode } from '@internal/llm-recorder';
import { setupDummyApiKeys } from '@internal/test-utils';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ENGINES,
  PREFILL_REPAIR_MARKER,
  PROVIDERS,
  assistantEndedRequests,
  chunksOfType,
  createCellMemory,
  errorChunks,
  isReplayDeterministic,
  persistedMessages,
  prefillRepairs,
  recordProviderRequests,
  streamTurn,
  useRecordedMock,
} from './durable-harness-helpers';
import type { Engine } from './durable-harness-helpers';
import { transformRequest } from './transform-request';

const MODE = getLLMTestMode();
const RECORDING_NAME = 'memory-integration-tests-src-durable-agent-background-tools';

const VARIANTS = ['foreground', 'deferred', 'awaited'] as const;
type Variant = (typeof VARIANTS)[number];

const AMOUNT = 42;

setupDummyApiKeys(MODE, ['openai', 'anthropic']);

const TASK_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** Background tasks mint a fresh task id per run and hand it to the model in the placeholder
 * result (and again in the completion notification), so the shared normalizer alone cannot keep
 * the request hash stable. Redact it here rather than touching the shared helper. */
function transformT4Request(input: { url: string; body: unknown }) {
  const { url, body } = transformRequest(input);
  return { url, body: JSON.parse(JSON.stringify(body).replace(TASK_ID, 'REDACTED-TASK-ID')) };
}

/** The harness reads `_background.disposition` off the call; `deferred` is also what a plain
 * `_background` object means, so an omitted disposition on that variant is compliant. */
function promptFor(variant: Variant) {
  return (
    `Call fetchRecord exactly once with name "comparison" and _background: {"disposition": "${variant}"}. ` +
    `Do not call it again. When the result is available, reply with the amount.`
  );
}

function fetchRecordTool() {
  return createTool({
    id: 'fetchRecord',
    description: 'Fetch a record by name. Slow.',
    inputSchema: z.object({ name: z.string() }),
    execute: async ({ name }: { name: string }) => ({ name, amount: AMOUNT }),
    background: { enabled: true },
  } as any);
}

describe.each(Object.entries(PROVIDERS))('T4 background tools · %s', (provider, model) => {
  describe.each(ENGINES)('%s engine', engine => {
    // One recording file per provider × engine, covering the foreground/deferred/awaited variants.
    const mock = useRecordedMock(`${RECORDING_NAME}-${provider}-${engine}`, { transformRequest: transformT4Request });
    let recorder: ReturnType<typeof recordProviderRequests>;

    beforeEach(() => {
      recorder = recordProviderRequests();
    });

    afterEach(() => {
      recorder.restore();
    });

    it.each(VARIANTS)(
      '%s',
      async variant => {
        const { storage, memory, cleanup } = await createCellMemory(`t4-${provider}-${engine}-${variant}`);
        const thread = `t4-thread-${provider}-${engine}-${variant}`;
        const resource = `t4-resource-${provider}-${engine}-${variant}`;
        const runId = `t4-run-${provider}-${engine}-${variant}-${randomUUID()}`;

        const agent = new Agent({
          id: `t4-agent-${provider}-${engine}-${variant}`,
          name: 't4',
          model,
          memory,
          instructions: 'Use tools exactly as instructed. When the fetched record arrives, report its amount.',
          tools: { fetchRecord: fetchRecordTool() },
          backgroundTasks: { tools: { fetchRecord: true } },
        } as any);

        const runner =
          engine === 'plain'
            ? agent
            : engine === 'durable'
              ? createDurableAgent({ agent })
              : createEventedAgent({ agent });

        const mastra = new Mastra({
          logger: false,
          storage,
          backgroundTasks: { enabled: true },
          agents: { [agent.id]: runner as any },
        } as any);
        if (engine !== 'plain') {
          expect((runner as any).getWorkflow().engineType).toBe(engine === 'evented' ? 'evented' : 'default');
        }
        await (mastra as any).startWorkers?.();

        const { chunks, threw, finishPayloads, errorPayloads } = await streamTurn(
          runner,
          engine as Engine,
          promptFor(variant),
          {
            memory: { thread, resource },
            runId,
            untilIdle: { maxIdleMs: 60_000 },
            maxSteps: 6,
          },
        );

        try {
          // Settled: the run does not throw, finishes once, and surfaces no error/abort/tripwire chunk.
          expect(threw).toBeNull();
          expect(errorChunks(chunks)).toEqual([]);
          expect(errorPayloads).toEqual([]);
          expect(finishPayloads).toHaveLength(1);

          // Ticket COR-1443 (moved from COR-1465): the claim is "provider rejects -> handler repairs ->
          // run completes", not "no request ends on an assistant turn". The old harness check forbade
          // the real fix (PrefillErrorHandler) and rewarded the reverted `Continue.` insertion.
          // Anthropic must show the 400 prefill rejection followed by a repaired request; OpenAI is
          // the control and must never be rejected or repaired.
          const repairs = prefillRepairs(recorder.requests);
          const endedByProvider = assistantEndedRequests(recorder.requests);
          const bodies = recorder.requests.map(request => JSON.stringify(request.body ?? ''));
          expect(
            [...errorChunks(chunks), threw ?? ''].filter(message => /prefill|assistant message/i.test(message)),
          ).toEqual([]);
          expect(repairs.unrepaired).toEqual([]);
          expect(repairs.spurious).toEqual([]);

          if (provider === 'anthropic') {
            const rejected = endedByProvider.rejected;
            for (const { i } of rejected) {
              expect(recorder.requests[i]!.status).toBe(400);
              expect(recorder.requests[i]!.responseText).toMatch(/does not support assistant message prefill/);
            }
            expect(repairs.repaired.length).toBe(repairs.ended.length);
            // Background dispositions re-enter the model after the tool result, which is the request
            // shape that trips Anthropic's prefill guard; the foreground path never produces it, so
            // there is nothing to reject there.
            if (variant === 'foreground') {
              expect(rejected).toEqual([]);
            } else {
              expect(rejected.length).toBeGreaterThan(0);
            }
          } else {
            expect(repairs.ended).toEqual([]);
            expect(recorder.requests.every(request => request.status === 200)).toBe(true);
            // The control must see the contrast: an OpenAI request ending on an assistant turn is
            // accepted as-is (200) and is not pre-repaired.
            if (variant === 'foreground') {
              expect(endedByProvider.accepted).toEqual([]);
            } else {
              expect(endedByProvider.accepted.length).toBeGreaterThan(0);
            }
            for (const { i } of endedByProvider.accepted) {
              expect(recorder.requests[i]!.status).toBe(200);
              expect(bodies[i]!).not.toContain(PREFILL_REPAIR_MARKER);
            }
          }

          const toolCallChunks = chunksOfType(chunks, 'tool-call').filter(
            (chunk: any) => chunk.payload?.toolName === 'fetchRecord',
          );
          const messages = await persistedMessages(memory, thread, resource);
          // The reverted continuation fix inserted a synthetic `Continue.` turn; the repaired run must
          // not persist one.
          expect(JSON.stringify(messages)).not.toContain('Continue.');
          const parts = messages.flatMap((message: any) => message?.content?.parts ?? []);
          const invocations = parts
            .filter((part: any) => part?.type === 'tool-invocation' && part.toolInvocation?.toolName === 'fetchRecord')
            .map((part: any) => part.toolInvocation);
          const persistedResults = invocations.filter((invocation: any) => invocation.state === 'result');
          const orphanedCalls = invocations.filter((invocation: any) => invocation.state !== 'result');

          // NOT EXERCISED only while recording: a live model is free to ignore the instruction.
          // In replay the run is fixed, so a missing call means the fixture or request shape drifted.
          if (invocations.length === 0) {
            expect(toolCallChunks).toEqual([]);
            expect(isReplayDeterministic(mock)).toBe(false);
            return;
          }
          // Same rule for the disposition this variant asks for.
          if (!invocations.some((invocation: any) => invocation.args?._background?.disposition === variant)) {
            expect(isReplayDeterministic(mock)).toBe(false);
            return;
          }

          // F9 (COR-1311): each tool call is streamed exactly once — one `tool-call` chunk per toolCallId.
          // (The model may call more than once; the comparable claim is the per-call ratio, not the count.)
          const streamedCallIds = toolCallChunks.map((chunk: any) => chunk.payload?.toolCallId);
          expect(streamedCallIds.length).toBe(new Set(streamedCallIds).size);
          expect(new Set(streamedCallIds)).toEqual(
            new Set(invocations.map((invocation: any) => invocation.toolCallId)),
          );

          // No orphaned tool call in the transcript, and every committed result carries the record
          // the tool actually returned.
          expect(orphanedCalls).toEqual([]);
          expect(persistedResults).toHaveLength(invocations.length);
          for (const result of persistedResults) {
            expect(result.result).toMatchObject({ name: 'comparison', amount: AMOUNT });
          }

          // The tool ran with the disposition each call asked for: non-foreground calls are dispatched
          // as one background task per call, foreground calls must not leave one behind.
          const bgStore = await storage.getStore('backgroundTasks');
          const { tasks } = await bgStore!.listTasks({ runId, perPage: 50 });
          const backgroundCalls = invocations.filter(
            (invocation: any) => invocation.args?._background?.disposition !== 'foreground',
          );
          expect(new Set(tasks.map(task => task.toolCallId))).toEqual(
            new Set(backgroundCalls.map((invocation: any) => invocation.toolCallId)),
          );
          for (const task of tasks) expect(task.status).toBe('completed');
          if (backgroundCalls.length > 0) {
            expect(chunksOfType(chunks, 'background-task-completed').length).toBeGreaterThanOrEqual(1);
          }
        } finally {
          await (mastra as any).backgroundTaskManager?.shutdown?.();
          await (mastra as any).stopWorkers?.();
          await cleanup();
        }
      },
      180_000,
    );
  });
});
