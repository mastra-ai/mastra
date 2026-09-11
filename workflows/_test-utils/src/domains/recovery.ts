/**
 * Crash-recovery tests (Phase 2 Item 9 — the acceptance gate for the durable
 * engines' headline promise): a run killed mid-loop must be discoverable and
 * re-drivable to a terminal state by a *fresh host* holding nothing but the
 * same storage.
 *
 * Each test simulates a two-process deployment inside one JS process:
 *
 *  - "Host 1" gets a model that hangs forever once its stream is entered, so
 *    the run persists its workflow-input snapshot and running step-result and
 *    then dies mid-LLM-call — the longest-running crash window and the one
 *    durability exists to survive.
 *  - The crash is simulated by dropping the run's in-process registry entry
 *    WITHOUT running graceful teardown (a dead process never cleans up).
 *  - "Host 2" is built over the same storage with the same agent id but its
 *    own pubsub (a restarted process has a new bus) and a working model, then
 *    recovers via `listActiveRuns()` / `recoverActiveRuns()` / `recover()`.
 *
 * Also carries the #19375 watch item: processor data chunks persisted before
 * the crash must not be voided by consumer-side handling on replay.
 *
 * Engine support: default (DurableAgent) and evented (EventedAgent). The
 * Inngest leg sets `skip.recovery` — Inngest orchestrates retries externally
 * and its harness cannot host two in-process "processes".
 */

import { describe, it, expect } from 'vitest';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { globalRunRegistry } from '@mastra/core/agent/durable';
import { MockMemory } from '@mastra/core/memory';
import { MockStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { DurableAgentTestContext } from '../types';

/** Generous per-test budget: each test runs two hosts plus recovery polling. */
const TEST_TIMEOUT_MS = 30_000;

let uniqueCounter = 0;
function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++uniqueCounter}`;
}

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

async function sleep(ms: number): Promise<void> {
  await new Promise(r => setTimeout(r, ms));
}

async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
  intervalMs = 200,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await sleep(intervalMs);
  }
  throw new Error(`waitUntil timed out after ${timeoutMs}ms`);
}

/**
 * Kill "host 1" from the run's point of view: a crashed process loses its
 * in-memory registry but never runs graceful teardown. Deleting a registry
 * entry fires the TTL cache's dispose hook (which calls `entry.cleanup()`),
 * so neuter cleanup first — otherwise the "crash" would abort the run and
 * tear down its streams the way a live shutdown would, which is exactly what
 * a real crash does NOT do.
 */
function simulateHostCrash(runId: string): void {
  const entry = globalRunRegistry.get(runId);
  if (entry) {
    (entry as { cleanup?: unknown }).cleanup = undefined;
    globalRunRegistry.delete(runId);
  }
}

/** Model that signals once its stream is entered, then hangs forever. */
function createHangingModel(onReached: () => void): LanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => {
      onReached();
      // Never resolves — the "process" dies mid-LLM call.
      return new Promise(() => {});
    },
  }) as unknown as LanguageModelV2;
}

/** Model: call 1 returns a tool call, call 2 signals and hangs forever. */
function createToolThenHangModel(
  toolName: string,
  args: Record<string, unknown>,
  onReached: () => void,
): LanguageModelV2 {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call' as const,
              toolCallId: 'tc-1',
              toolName,
              input: JSON.stringify(args),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: 'tool-calls' as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      onReached();
      return new Promise(() => {});
    },
  }) as unknown as LanguageModelV2;
}

/** Text model that counts invocations, so tests can prove recovery re-drove the LLM. */
function createCountingTextModel(text: string): { model: LanguageModelV2; calls: { count: number } } {
  const calls = { count: 0 };
  const model = new MockLanguageModelV2({
    doStream: async () => {
      calls.count++;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-r', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: text },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  }) as unknown as LanguageModelV2;
  return { model, calls };
}

export function createRecoveryTests(context: DurableAgentTestContext) {
  const { createAgent, eventPropagationDelay } = context;

  /** Wait long enough for the run's snapshots to settle before "killing" the host. */
  const settleDelay = eventPropagationDelay * 2 + 300;

  describe('crash recovery', () => {
    it(
      'discovers a run orphaned by a crashed host and re-drives it to a terminal state',
      async () => {
        const storage = new MockStore();
        const agentId = uniqueId('recovery-bulk-agent');
        const reached = createDeferred();

        // Host 1: model hangs mid-LLM-call, then the process "dies".
        const host1 = await createAgent({
          id: agentId,
          exactId: true,
          storage,
          name: 'Recovery Agent',
          instructions: 'You are a helpful assistant',
          model: createHangingModel(reached.resolve),
        });
        const { runId } = await host1.stream('hello');
        await reached.promise;
        await sleep(settleDelay);
        simulateHostCrash(runId);

        // Host 2: fresh bus, same storage, working model.
        const host2Model = createCountingTextModel('Recovered response.');
        const host2 = await createAgent({
          id: agentId,
          exactId: true,
          storage,
          isolatedPubsub: true,
          name: 'Recovery Agent',
          instructions: 'You are a helpful assistant',
          model: host2Model.model,
        });

        // The orphaned run is discoverable from storage alone.
        const listed = await host2.listActiveRuns!();
        expect(listed.runs.map(r => r.runId)).toContain(runId);

        // Bulk recovery re-drives it.
        const result = await host2.recoverActiveRuns!();
        expect(result.failed).toBe(0);
        expect(result.succeeded).toBe(1);
        expect(result.recovered.find(r => r.runId === runId)?.status).toBe('success');

        // Terminal cleanup: the run must stop being discoverable as active.
        await waitUntil(async () => {
          const after = await host2.listActiveRuns!();
          return !after.runs.some(r => r.runId === runId);
        }, 10_000);

        // Recovery actually re-entered the in-flight LLM step on host 2.
        expect(host2Model.calls.count).toBeGreaterThan(0);
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'recover(runId) resumes the in-flight LLM step and streams the completion',
      async () => {
        const storage = new MockStore();
        const agentId = uniqueId('recovery-stream-agent');
        const reached = createDeferred();

        const host1 = await createAgent({
          id: agentId,
          exactId: true,
          storage,
          name: 'Recovery Agent',
          instructions: 'You are a helpful assistant',
          model: createHangingModel(reached.resolve),
        });
        const { runId } = await host1.stream('hello');
        await reached.promise;
        await sleep(settleDelay);
        simulateHostCrash(runId);

        const host2Model = createCountingTextModel('Recovered stream response.');
        const host2 = await createAgent({
          id: agentId,
          exactId: true,
          storage,
          isolatedPubsub: true,
          name: 'Recovery Agent',
          instructions: 'You are a helpful assistant',
          model: host2Model.model,
        });

        const recovered = await host2.recover!(runId);
        expect(recovered.runId).toBe(runId);

        // The recovered stream carries the re-driven completion to a terminal.
        let text = '';
        let sawFinish = false;
        for await (const chunk of recovered.output.fullStream) {
          if (chunk.type === 'text-delta') text += chunk.payload?.text ?? '';
          if (chunk.type === 'finish') sawFinish = true;
        }
        expect(sawFinish).toBe(true);
        expect(text).toContain('Recovered stream response.');
        expect(host2Model.calls.count).toBeGreaterThan(0);
        recovered.cleanup();
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'processor data chunks persisted before the crash survive recovery (#19375)',
      async () => {
        const storage = new MockStore();
        // One memory instance shared across both hosts — stands in for the
        // external memory store both real processes would talk to.
        const memory = new MockMemory();
        const agentId = uniqueId('recovery-data-agent');
        const reached = createDeferred();

        const processor = {
          id: 'tool-data-emitter',
          name: 'Tool Data Emitter',
          processToolResult: async ({ writer }: any) => {
            await writer?.custom({ type: 'data-tool-note', data: { note: 'recovery-persisted-note' } });
          },
        };
        const weatherTool = createTool({
          id: 'getWeather',
          description: 'Get weather',
          inputSchema: z.object({ city: z.string() }),
          outputSchema: z.object({ temp: z.number() }),
          execute: async () => ({ temp: 72 }),
        });

        // Host 1: tool call succeeds (processor emits its data chunk), then
        // the second LLM call hangs and the process "dies".
        const host1 = await createAgent({
          id: agentId,
          exactId: true,
          storage,
          memory,
          outputProcessors: [processor],
          tools: { getWeather: weatherTool },
          name: 'Recovery Data Agent',
          instructions: 'You are a helpful assistant',
          model: createToolThenHangModel('getWeather', { city: 'NYC' }, reached.resolve),
        });
        const { runId } = await host1.stream('what is the weather in NYC?', {
          memory: { thread: 'thread-recovery-data', resource: 'resource-recovery-data' },
        });
        await reached.promise;
        await sleep(settleDelay);
        simulateHostCrash(runId);

        const host2Model = createCountingTextModel('Recovered weather summary.');
        const host2 = await createAgent({
          id: agentId,
          exactId: true,
          storage,
          memory,
          isolatedPubsub: true,
          outputProcessors: [processor],
          tools: { getWeather: weatherTool },
          name: 'Recovery Data Agent',
          instructions: 'You are a helpful assistant',
          model: host2Model.model,
        });

        const result = await host2.recoverActiveRuns!();
        expect(result.failed).toBe(0);
        expect(result.succeeded).toBe(1);

        // The recovered run flushes to memory: the pre-crash data chunk must
        // survive the replay alongside the post-recovery completion.
        await waitUntil(async () => {
          const recalled = await memory.recall({
            threadId: 'thread-recovery-data',
            resourceId: 'resource-recovery-data',
          });
          const serialized = JSON.stringify(recalled.messages);
          return serialized.includes('recovery-persisted-note') && serialized.includes('Recovered weather summary.');
        }, 10_000);

        const recalled = await memory.recall({
          threadId: 'thread-recovery-data',
          resourceId: 'resource-recovery-data',
        });
        const serialized = JSON.stringify(recalled.messages);
        expect(serialized).toContain('recovery-persisted-note');
        expect(serialized).toContain('Recovered weather summary.');
      },
      TEST_TIMEOUT_MS,
    );
  });
}
