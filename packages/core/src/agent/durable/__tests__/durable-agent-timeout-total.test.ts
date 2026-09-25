/**
 * DurableAgent run-level timeout tests (`modelSettings.timeout.totalMs`,
 * #21724 parity port).
 *
 * The total budget bounds a whole execution session — every loop iteration,
 * tool call and retry. Semantics mirror the main loop's timeout-total.test.ts:
 * - an exhausted budget surfaces as a run *failure* (MastraTimeoutError error
 *   chunk), never as a clean abort;
 * - an exhausted budget must not fall back to the next model (the budget is
 *   shared, another attempt would start already-expired);
 * - runs finishing within the budget, and runs with no budget, are untouched;
 * - a caller abort with an armed budget follows the normal abort path and is
 *   not misreported as a timeout.
 *
 * Deliberate divergence from main: durable's fatal path emits both an error
 * chunk and a step-finish/finish with reason 'error' (main emits no finish),
 * because the durable finalization block owns stream closure.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

function hangingModel() {
  return new MockLanguageModelV2({
    doStream: () => new Promise(() => {}),
    doGenerate: () => new Promise(() => {}),
  });
}

function textModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/** First call emits a tool call; any later call would answer with text. */
function toolCallingModel(toolName: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            { type: 'tool-call' as const, toolCallId: 'tc-1', toolName, input: JSON.stringify({ city: 'NYC' }) },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-2', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Done.' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

async function drain(stream: ReadableStream<any>) {
  const out: any[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

function findTimeoutErrorChunk(chunks: any[]) {
  return chunks.find((c: any) => c.type === 'error' && c.payload?.error?.name === 'MastraTimeoutError');
}

describe('DurableAgent modelSettings.timeout.totalMs (#21724)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  function setup(model: LanguageModelV2 | Array<{ model: LanguageModelV2; maxRetries: number }>, tools?: any) {
    const baseAgent = new Agent({
      id: 'timeout-agent',
      name: 'Timeout Agent',
      instructions: 'You are a helpful agent.',
      model: model as any,
      ...(tools ? { tools } : {}),
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'timeout-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });
    return durableAgent;
  }

  it('terminates a hanging run as a failure with a total-timeout error chunk', async () => {
    const durableAgent = setup(hangingModel() as LanguageModelV2);

    const result = await durableAgent.stream('hello', {
      modelSettings: { timeout: { totalMs: 150 } },
    });
    const chunks = await drain(result.fullStream);

    const errorChunk = findTimeoutErrorChunk(chunks);
    expect(errorChunk).toBeDefined();
    expect(errorChunk.payload.error.message).toContain('totalMs');
    // Fails through the error path — not a clean stop, and not masked as a
    // caller abort.
    const finish = chunks.find((c: any) => c.type === 'finish');
    expect(finish?.payload?.stepResult?.reason).toBe('error');
    result.cleanup();
  });

  it('does not fall back to the next model when the total budget is exhausted', async () => {
    const fallback = textModel('from fallback');
    const doStreamSpy = vi.spyOn(fallback as any, 'doStream');
    const durableAgent = setup([
      { model: hangingModel() as LanguageModelV2, maxRetries: 0 },
      { model: fallback as LanguageModelV2, maxRetries: 0 },
    ]);

    const result = await durableAgent.stream('hello', {
      modelSettings: { timeout: { totalMs: 150 } },
    });
    const chunks = await drain(result.fullStream);

    expect(findTimeoutErrorChunk(chunks)).toBeDefined();
    expect(doStreamSpy).not.toHaveBeenCalled();
    result.cleanup();
  });

  it('fails the run when the budget expires during a tool call (between iterations)', async () => {
    const model = toolCallingModel('slowTool');
    const doStreamSpy = vi.spyOn(model as any, 'doStream');
    const slowTool = createTool({
      id: 'slowTool',
      description: 'A slow tool',
      inputSchema: z.object({ city: z.string() }),
      execute: async () => {
        await new Promise(resolve => setTimeout(resolve, 400));
        return { ok: true };
      },
    });
    const durableAgent = setup(model as LanguageModelV2, { slowTool });

    const result = await durableAgent.stream('hello', {
      modelSettings: { timeout: { totalMs: 200 } },
    });
    const chunks = await drain(result.fullStream);

    // The budget expired while the tool ran: the next llm-execution iteration
    // must fail the run instead of settling it as a clean abort, and must not
    // invoke the model again.
    expect(findTimeoutErrorChunk(chunks)).toBeDefined();
    expect(doStreamSpy).toHaveBeenCalledTimes(1);
    result.cleanup();
  });

  it('leaves a run that finishes within the budget untouched', async () => {
    const durableAgent = setup(textModel('quick answer') as LanguageModelV2);

    const result = await durableAgent.stream('hello', {
      modelSettings: { timeout: { totalMs: 30_000 } },
    });
    const chunks = await drain(result.fullStream);

    expect(chunks.some((c: any) => c.type === 'error')).toBe(false);
    expect(chunks.some((c: any) => c.type === 'finish')).toBe(true);
    expect(chunks.filter((c: any) => c.type === 'text-delta').length).toBeGreaterThan(0);
    result.cleanup();
  });

  it('is inert when no total budget is configured', async () => {
    const durableAgent = setup(textModel('no budget') as LanguageModelV2);

    const result = await durableAgent.stream('hello');
    const chunks = await drain(result.fullStream);

    expect(chunks.some((c: any) => c.type === 'error')).toBe(false);
    expect(chunks.some((c: any) => c.type === 'finish')).toBe(true);
    result.cleanup();
  });

  it('still honours a caller-supplied abort signal without misreporting it as a timeout', async () => {
    const durableAgent = setup(hangingModel() as LanguageModelV2);
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error('user cancelled')), 50);

    const result = await durableAgent.stream('hello', {
      abortSignal: controller.signal,
      modelSettings: { timeout: { totalMs: 30_000 } },
    });
    const chunks = await drain(result.fullStream);

    // The abort settles the run through the normal abort path; what matters is
    // that it is not misreported as a timeout failure.
    expect(findTimeoutErrorChunk(chunks)).toBeUndefined();
    const finish = chunks.find((c: any) => c.type === 'finish');
    expect(finish?.payload?.stepResult?.reason).toBe('abort');
    result.cleanup();
  });

  it('re-arms the persisted run-level budget after a cold restart (recover)', async () => {
    const storage = new InMemoryStore();
    const build = () => {
      const baseAgent = new Agent({
        id: 'timeout-restart-agent',
        name: 'Timeout Restart Agent',
        instructions: 'You are a helpful agent.',
        model: hangingModel() as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      // `running` checkpoints — the rows recover() reads — are only persisted
      // under the auto-recovery policy (#23915).
      new Mastra({
        agents: { 'timeout-restart-agent': durableAgent as any },
        logger: false,
        storage,
        pubsub,
        recovery: { durableAgents: 'auto' },
      });
      return durableAgent;
    };

    // ---- Process 1: start a budgeted run against a hanging model. ----
    const firstDurable = build();
    const started = await firstDurable.stream('hello', {
      modelSettings: { timeout: { totalMs: 2000 } },
    });
    const runId = (started as unknown as { runId: string }).runId;

    // Write side of the regression: the run-level budget must survive
    // serializeModelSettings into the persisted workflow input — this is the
    // field cold recovery reads back.
    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(async () => {
      const persisted = await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
      const snapshot = typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
      expect(snapshot?.context?.input?.options?.modelSettings?.timeout?.totalMs).toBe(2000);
    });

    // ---- The restart: nothing of process 1 survives but its storage.
    // clear() runs each entry's cleanup, which also disarms process 1's
    // in-memory budget timer — exactly what a real crash does.
    globalRunRegistry.clear();
    await pubsub.close();
    pubsub = new EventEmitterPubSub();

    // ---- Process 2: recover the run; the model hangs again. ----
    const secondDurable = build();
    const recovered = await secondDurable.recover(runId);

    // Read side: the rebuilt registry entry restored the budget from the
    // persisted snapshot.
    expect(globalRunRegistry.get(runId)?.timeoutTotalMs).toBe(2000);

    // Behavioral proof: the recovered session is bounded — the restored
    // budget fails the hanging run instead of letting it run unbounded.
    const chunks = await drain(recovered.fullStream);
    const errorChunk = findTimeoutErrorChunk(chunks);
    expect(errorChunk).toBeDefined();
    expect(errorChunk.payload.error.message).toContain('totalMs');
    recovered.cleanup();
  }, 30000);
});
