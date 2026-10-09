/**
 * Public-agent-level regression tests for
 * https://github.com/mastra-ai/mastra/issues/25974 ("Durable agent: thread
 * stays busy forever when the run's stream never gets a terminal event").
 *
 * `durable-stream-adapter-termination.test.ts` exercises `createDurableAgentStream`
 * directly (calling `forceError()`/`cleanup()` by hand). It does not exercise the
 * `.finally()` wiring this fix added to `DurableAgent.stream()` / `generate()` /
 * `resume()` (the `#ensureDurableStreamTerminated` helper) — a regression in that
 * caller wiring could leave a thread busy forever while the adapter-level tests
 * still pass. These tests drive a real `DurableAgent` end to end instead.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AgentStreamEventTypes, AGENT_STREAM_TOPIC } from '../constants';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function settleWithin<T>(promise: Promise<T>, ms: number): Promise<'done' | 'timeout'> {
  return Promise.race([promise.then(() => 'done' as const), delay(ms).then(() => 'timeout' as const)]);
}

async function readFullStream(stream: ReadableStream<any>): Promise<any[]> {
  const chunks: any[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

/**
 * Reads chunks until `predicate` matches one, then cancels the reader and
 * returns what was collected so far. Needed for a suspended-but-not-closed
 * stream (the default `closeOnSuspend: false`): the stream never emits a
 * terminal `done`, so draining it with `for await` (as `readFullStream`
 * does) would hang forever waiting for chunks that will never arrive.
 */
async function readStreamUntil(
  stream: ReadableStream<any>,
  predicate: (chunk: any) => boolean,
  limit = 50,
): Promise<any[]> {
  const reader = stream.getReader();
  const chunks: any[] = [];
  try {
    while (chunks.length < limit) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      if (predicate(value)) break;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // best-effort cleanup only
    }
  }
  return chunks;
}

function createTextModel(): LanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'hello' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  }) as unknown as LanguageModelV2;
}

function createApprovalToolModel(): LanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: 'call-1',
          toolName: 'request_approval',
          input: JSON.stringify({ question: 'Proceed?' }),
          providerExecuted: false,
        },
        { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  }) as unknown as LanguageModelV2;
}

describe('DurableAgent.stream() termination safety net (issue #25974)', () => {
  it('settles fullStream and _waitUntilFinished(), fires onError once, and clears the busy thread when the FINISH event is dropped in transit', async () => {
    // Simulates the issue's "FINISH event is dropped, or whose publish of it
    // throws" case: everything else on the agent-stream topic is delivered
    // normally, only the FINISH event never reaches the stream adapter.
    const pubsub = new EventEmitterPubSub();
    const originalPublish = pubsub.publish.bind(pubsub);
    vi.spyOn(pubsub, 'publish').mockImplementation(async (topic: string, event: any, options?: any) => {
      if (event?.type === AgentStreamEventTypes.FINISH) return;
      return originalPublish(topic, event, options);
    });

    const baseAgent = new Agent({
      id: 'termination-safety-net-agent',
      name: 'Termination Safety Net Agent',
      instructions: 'Test',
      model: createTextModel(),
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const onError = vi.fn();
    const threadId = 'thread-dropped-finish';
    const resourceId = 'resource-dropped-finish';
    const { output, runId, cleanup } = await durableAgent.stream('hello', {
      memory: { thread: threadId, resource: resourceId },
      onError,
    });

    const reader = readFullStream(output.fullStream as ReadableStream<any>);
    const waitUntilFinished = output._waitUntilFinished();

    expect(await settleWithin(waitUntilFinished, 5000)).toBe('done');
    expect(await settleWithin(reader, 5000)).toBe('done');

    const chunks = await reader;
    expect(chunks.some(c => c.type === 'error')).toBe(true);
    expect(chunks.some(c => c.type === 'finish')).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);

    // The thread must no longer be reported as busy — the whole point of
    // #25974 was that it stayed "busy" forever with no way to recover.
    expect(durableAgent.getActiveThreadRunId({ threadId, resourceId })).toBeUndefined();

    expect(output.status).toBe('failed');
    expect(runId).toBeDefined();
    cleanup();
  });

  it('does not force-error a run that genuinely suspended, even though nothing consumed the stream before the workflow settled', async () => {
    // Reproduces the race CodeRabbit flagged on the initial fix: with the
    // default closeOnSuspend=false, output.status only flips to 'suspended'
    // once a caller reads the suspend chunk. #ensureDurableStreamTerminated
    // runs as soon as the driving workflow settles — here, deliberately
    // before anything reads fullStream — so if it still relied on
    // output.status it would race a genuinely suspended run and force-error
    // it. wasSuspended() must have already caught the SUSPENDED event
    // synchronously during pubsub delivery, independent of consumption.
    const pubsub = new EventEmitterPubSub();

    const approvalTool = createTool({
      id: 'request_approval',
      description: 'Ask the user to approve before continuing',
      inputSchema: z.object({ question: z.string() }),
      suspendSchema: z.object({ question: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async (input: any, context: any) => {
        const agentCtx = context?.agent ?? context ?? {};
        if (agentCtx.resumeData != null) return { approved: agentCtx.resumeData.approved };
        await agentCtx.suspend?.({ question: input.question });
        return { approved: false };
      },
    });

    const baseAgent = new Agent({
      id: 'suspend-safety-net-agent',
      name: 'Suspend Safety Net Agent',
      instructions: 'Call request_approval.',
      model: createApprovalToolModel(),
      tools: { request_approval: approvalTool },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const onError = vi.fn();
    const threadId = 'thread-suspend-race';
    const resourceId = 'resource-suspend-race';
    const { output, runId, cleanup } = await durableAgent.stream('Please proceed', {
      memory: { thread: threadId, resource: resourceId },
      onError,
    });

    // Deliberately do NOT touch output.fullStream / getFullOutput() here —
    // consuming it would itself flip output.status and mask the race this
    // test exists to catch. Instead, wait for the workflow to actually
    // suspend by polling the one thing that doesn't require consumption:
    // the run no longer being listed as active-and-unsuspended is not
    // observable without consuming either, so poll a generous fixed window
    // long enough for suspend, the FINISH-safety-net's pubsub.flush() +
    // waitForEventDelivery(), and any forceError() this test must prove
    // never fires.
    await delay(1500);

    expect(onError).not.toHaveBeenCalled();

    // Only now consume the stream, proving it is still the genuine suspend —
    // not a safety-net error chunk that raced ahead of it. With the default
    // closeOnSuspend: false the stream is never closed by a suspend alone, so
    // read only until the suspend chunk shows up instead of draining to
    // completion (see readStreamUntil's doc comment).
    const chunks = await readStreamUntil(output.fullStream as ReadableStream<any>, c => c.type === 'tool-call-suspended');
    expect(chunks.some(c => c.type === 'tool-call-suspended')).toBe(true);
    expect(chunks.some(c => c.type === 'error')).toBe(false);
    expect(runId).toBeDefined();

    cleanup();
  }, 10000);
});
