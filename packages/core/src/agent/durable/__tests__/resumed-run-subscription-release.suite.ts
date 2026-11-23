/**
 * Resumed runs release their subscriptions when they finish (issue #30479).
 *
 * A durable run subscribes to `agent.stream.<runId>` (one reader per stream()/
 * resume() segment) and, on the process executing it, to `agent.control.<runId>`
 * (the remote abort listener). On Redis Streams each subscription holds a
 * dedicated blocking connection.
 *
 * Thread-API runs that are not paused release these right away through the
 * idle loop. A run that paused for approval and was resumed with
 * `sendStreamResume()` used to keep all of them (the paused segment's reader,
 * the resume reader and the abort listener) until `cleanupTimeoutMs`, which
 * users raise to keep the replay window of `observe()` open.
 *
 * Contract locked in here:
 * - a paused run keeps its reader and abort listener, so the approval works;
 * - once the resumed run finishes, every subscription is released without
 *   waiting for `cleanupTimeoutMs`;
 * - the run's history and run record still stay for `cleanupTimeoutMs`, so
 *   `observe()` replays the finished run;
 * - aborting the finished run is not acknowledged, like a finished plain run.
 *
 * Shared so every PubSub transport runs the same scenario; on Redis Streams the
 * suite also counts the server's open connections. Lives with @mastra/core's
 * tests; there is no public export.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { PubSub } from '../../../events/pubsub';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { AGENT_CONTROL_TOPIC, AGENT_STREAM_TOPIC } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import type { DurableAgent } from '../durable-agent';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
// Far longer than any test: anything released here was not released by the timer.
const CLEANUP_MS = 60_000;
type ClosablePubSub = PubSub & { close(): Promise<void> };

export interface ResumedRunReleaseSuiteOptions {
  /** A fresh transport per test; the agent wraps it in its CachingPubSub. */
  createPubSub(): ClosablePubSub;
  /** The transport's open server connections, when it has any (Redis Streams). */
  openConnections?(): Promise<number>;
}

const scope = { resourceId: 'resource-1', threadId: 'thread-1' };

/** Calls the `ask` tool until the prompt holds `toolResults` tool results, then answers. */
function makeModel(toolResults: number) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const results = JSON.stringify(prompt).split('"type":"tool-result"').length - 1;
      const wantsTool = JSON.stringify(prompt).includes('ask me') && results < toolResults;
      const toolCallId = `tc-${results + 1}`;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream<any>([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'm', modelId: 'mock-model', timestamp: new Date(0) },
          ...(wantsTool
            ? [
                { type: 'tool-call', toolCallType: 'function', toolCallId, toolName: 'ask', input: '{}' },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : [
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'done' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage },
              ]),
        ]),
      };
    },
  });
}

/** Counts the live subscriptions per topic. */
function trackSubscriptions(pubsub: ClosablePubSub) {
  const live = new Map<string, number>();
  const subscribe = pubsub.subscribe.bind(pubsub);
  const unsubscribe = pubsub.unsubscribe.bind(pubsub);
  vi.spyOn(pubsub, 'subscribe').mockImplementation(async (topic, cb, options) => {
    live.set(topic, (live.get(topic) ?? 0) + 1);
    return subscribe(topic, cb, options);
  });
  vi.spyOn(pubsub, 'unsubscribe').mockImplementation(async (topic, cb) => {
    live.set(topic, (live.get(topic) ?? 0) - 1);
    return unsubscribe(topic, cb);
  });
  return (runId: string) => ({
    stream: live.get(AGENT_STREAM_TOPIC(runId)) ?? 0,
    control: live.get(AGENT_CONTROL_TOPIC(runId)) ?? 0,
  });
}

function createSetup(pubsub: ClosablePubSub, toolResults: number) {
  const agent = new Agent({
    id: 'resume-release-agent',
    name: 'Resume Release Agent',
    instructions: 'You are a helpful assistant',
    model: makeModel(toolResults),
    memory: new MockMemory(),
    tools: {
      ask: createTool({
        id: 'ask',
        description: 'Ask the user',
        inputSchema: z.object({}),
        execute: async (_input, ctx) =>
          ctx?.agent?.resumeData ? `answered ${ctx.agent.resumeData}` : ctx?.agent?.suspend({ question: 'ok?' }),
      }),
    },
  });
  const durable = createDurableAgent({ agent, pubsub, cleanupTimeoutMs: CLEANUP_MS });
  const storage = new InMemoryStore();
  void new Mastra({
    agents: { 'resume-release-agent': durable as any },
    storage,
    pubsub,
    logger: false,
    backgroundTasks: { enabled: true },
  } as any);
  return { agent: durable as DurableAgent, storage };
}

async function startPausedThreadRun(agent: DurableAgent) {
  const accepted = (await agent.sendMessage('please ask me something', scope).accepted) as any;
  for await (const chunk of accepted.output.fullStream) {
    if (chunk.type === 'tool-call-suspended') break;
  }
  return accepted.runId as string;
}

async function readSnapshot(storage: InMemoryStore, runId: string) {
  const workflows = await storage.getStore('workflows');
  const run: any = await workflows?.getWorkflowRunById({ runId, workflowName: 'durable-agentic-loop' });
  return typeof run?.snapshot === 'string' ? JSON.parse(run.snapshot) : run?.snapshot;
}

/** Waits until the pause is persisted, optionally for a given tool call. */
async function waitForSuspendedSnapshot(storage: InMemoryStore, runId: string, toolCallId = 'tc-1') {
  await vi.waitFor(
    async () => {
      const snapshot = await readSnapshot(storage, runId);
      expect(snapshot?.status).toBe('suspended');
      expect(JSON.stringify(snapshot)).toContain(toolCallId);
    },
    { timeout: 5_000 },
  );
}

/** Connections close asynchronously: wait until the count stops moving. */
async function settledConnections(openConnections: () => Promise<number>) {
  let previous = await openConnections();
  for (;;) {
    await new Promise(resolve => setTimeout(resolve, 250));
    const current = await openConnections();
    if (current === previous) return current;
    previous = current;
  }
}

export function defineResumedRunReleaseSuite(name: string, options: ResumedRunReleaseSuiteOptions) {
  describe(`DurableAgent releases a resumed run’s subscriptions when it finishes (issue #30479) [${name}]`, () => {
    let pubsub: ClosablePubSub | undefined;

    afterEach(async () => {
      vi.restoreAllMocks();
      await pubsub?.close();
      pubsub = undefined;
    });

    it('sendStreamResume(): keeps the subscriptions while paused and releases them all once the run finishes', async () => {
      pubsub = options.createPubSub();
      const live = trackSubscriptions(pubsub);
      const { agent, storage } = createSetup(pubsub, 1);

      // A plain thread run releases everything as soon as it finishes: its
      // connection count is the baseline the resumed run must return to.
      const plain = (await agent.sendMessage('hello', { ...scope, threadId: 'thread-plain' }).accepted) as any;
      await plain.output.consumeStream();
      await vi.waitFor(() => expect(live(plain.runId)).toEqual({ stream: 0, control: 0 }), { timeout: 5_000 });
      const baseline = options.openConnections && (await settledConnections(options.openConnections));

      const runId = await startPausedThreadRun(agent);
      await waitForSuspendedSnapshot(storage, runId);
      // Paused: the reader and the abort listener stay for the approval.
      expect(live(runId).stream).toBeGreaterThan(0);
      expect(live(runId).control).toBe(1);
      if (baseline !== undefined) expect(await options.openConnections!()).toBeGreaterThan(baseline);

      const resumed = await agent.sendStreamResume({ ...scope, runId, toolCallId: 'tc-1', resumeData: 'yes' });
      expect(resumed.accepted).toBe(true);

      await vi.waitFor(() => expect(live(runId)).toEqual({ stream: 0, control: 0 }), { timeout: 5_000 });
      if (baseline !== undefined) {
        await vi.waitFor(async () => expect(await options.openConnections!()).toBe(baseline), { timeout: 5_000 });
      }

      // History stays for cleanupTimeoutMs: a late observer still replays the finished run.
      const observed = await agent.observe(runId);
      const chunks: any[] = [];
      for await (const chunk of observed.output.fullStream) chunks.push(chunk);
      expect(chunks.at(-1)?.type).toBe('finish');
      expect(chunks.some(chunk => chunk.type === 'text-delta' && chunk.payload?.text === 'done')).toBe(true);
      observed.cleanup();

      // Nothing is executing the run any more, so no process acknowledges the abort.
      await expect((agent as any).__abortRunAcknowledged(runId)).resolves.toBe(false);
    }, 30_000);

    it('a run that pauses again after its first approval keeps its subscriptions for the second approval', async () => {
      pubsub = options.createPubSub();
      const live = trackSubscriptions(pubsub);
      const { agent, storage } = createSetup(pubsub, 2);

      const runId = await startPausedThreadRun(agent);
      await waitForSuspendedSnapshot(storage, runId);

      await agent.sendStreamResume({ ...scope, runId, toolCallId: 'tc-1', resumeData: 'first' });
      // The resumed run asks again: wait for the second pause to be persisted.
      await waitForSuspendedSnapshot(storage, runId, 'tc-2');
      expect(live(runId).stream).toBeGreaterThan(0);
      expect(live(runId).control).toBe(1);

      const second = await agent.sendStreamResume({ ...scope, runId, toolCallId: 'tc-2', resumeData: 'second' });
      expect(second.accepted).toBe(true);
      await vi.waitFor(() => expect(live(runId)).toEqual({ stream: 0, control: 0 }), { timeout: 5_000 });
    }, 30_000);

    it('stream() + resume(): releases every subscription once the resumed run finishes', async () => {
      pubsub = options.createPubSub();
      const live = trackSubscriptions(pubsub);
      const { agent, storage } = createSetup(pubsub, 1);

      const first = await agent.stream('please ask me something');
      const runId = first.runId;
      for await (const chunk of first.output.fullStream) {
        if (chunk.type === 'tool-call-suspended') break;
      }
      await waitForSuspendedSnapshot(storage, runId);
      expect(live(runId).control).toBe(1);

      const resumed = await agent.resume(runId, 'yes', { toolCallId: 'tc-1' });
      await resumed.output.consumeStream();

      await vi.waitFor(() => expect(live(runId)).toEqual({ stream: 0, control: 0 }), { timeout: 5_000 });
    }, 30_000);
  });
}
