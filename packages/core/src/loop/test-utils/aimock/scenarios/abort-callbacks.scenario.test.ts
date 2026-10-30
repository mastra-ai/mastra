/**
 * AIMock Scenario: Abort callbacks
 *
 * A user cancels a reply while it is still streaming. Every engine must report
 * that through the public callbacks the same way:
 * - `onAbort` fires exactly once and `onFinish` never fires
 * - the stream emits an `abort` chunk
 * - the `onAbort` payload carries the text streamed before the abort and the steps
 *   completed so far, with their usage
 * - the `onAbort` payload ends with the aborted step (finishReason `abort`).
 *   Only the durable engines do this today: the normal loop builds the payload
 *   from the steps completed before the aborted call, so that case is `it.fails`
 *   on `normal` and `fs`.
 *
 * A provider failure is the mirror case: `onError` fires and `onFinish` does not.
 *
 * The runs go through `agent.stream` directly because `runLoopScenario` does not
 * forward `onAbort`. The abort trigger is an external `AbortController`, which
 * every engine supports (`result.abort()` exists only on durable results).
 */

import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

const REPLY = 'Here is a long answer that the user cancels before it finishes streaming.';
// Slow the reply down so the abort lands while text is still arriving.
const slowStream = { chunkSize: 4, latency: 30 };

describeForAllEngines('AIMock loop scenario: abort callbacks', engine => {
  const getMock = useLoopScenarioAimock();
  // The normal loop's onAbort payload omits the in-flight step (llm-execution-step passes
  // `inputData.output.steps`), so it never ends with a finishReason `abort` step.
  const itFailsOnNormalLoop = engine === 'normal' || engine === 'fs' ? it.fails : it;

  async function streamAndAbortOnFirstText(agent: any, callbacks: Record<string, unknown>) {
    const controller = new AbortController();
    const result = await agent.stream('Tell me something long.', {
      maxSteps: 5,
      abortSignal: controller.signal,
      ...callbacks,
    });
    const output = isDurableEngineVariant(engine) ? result.output : result;
    const chunks: any[] = [];
    const deltas: string[] = [];
    try {
      for await (const chunk of output.fullStream) {
        chunks.push(chunk);
        if (chunk.type === 'text-delta') {
          deltas.push(chunk.payload.text);
          controller.abort();
        }
      }
    } catch {
      // Durable streams can reject with AbortError after the abort chunk.
    }
    result.cleanup?.();
    return { chunks, deltas };
  }

  it('cancelling a streaming reply fires onAbort with the streamed text, emits an abort chunk, and skips onFinish', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: REPLY }, slowStream);
    const { agent } = await createSharedAgent(llm, { engine });
    const onAbort = vi.fn();
    const onFinish = vi.fn();

    const { chunks, deltas } = await streamAndAbortOnFirstText(agent, { onAbort, onFinish });

    // Guard: the abort really landed mid-reply.
    expect(deltas.length).toBeGreaterThan(0);
    expect(deltas.join('').length).toBeLessThan(REPLY.length);

    expect(chunks.some(chunk => chunk.type === 'abort')).toBe(true);
    await vi.waitFor(() => expect(onAbort).toHaveBeenCalledTimes(1));
    expect(onFinish).not.toHaveBeenCalled();

    const payload = onAbort.mock.calls[0]![0];
    expect(REPLY.startsWith(payload.text)).toBe(true);
    expect(payload.text.length).toBeGreaterThan(0);
    expect(llm.getRequests()).toHaveLength(1);
  });

  itFailsOnNormalLoop('the onAbort payload ends with the aborted step', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: REPLY }, slowStream);
    const { agent } = await createSharedAgent(llm, { engine });
    const onAbort = vi.fn();

    await streamAndAbortOnFirstText(agent, { onAbort });

    await vi.waitFor(() => expect(onAbort).toHaveBeenCalledTimes(1));
    expect(onAbort.mock.calls[0]![0].steps.at(-1)?.finishReason).toBe('abort');
  });

  it('cancelling the second model call keeps the completed tool step and its usage in the onAbort payload', async () => {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [{ id: 'call_step', name: 'step', arguments: {} }],
        usage: { input_tokens: 10, output_tokens: 20 },
      },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: REPLY }, slowStream);
    const step = createTool({
      id: 'step',
      description: 'Take a step',
      inputSchema: z.object({}),
      execute: async () => 'done',
    });
    const { agent } = await createSharedAgent(llm, { engine, tools: { step } });
    const onAbort = vi.fn();
    const onFinish = vi.fn();

    await streamAndAbortOnFirstText(agent, { onAbort, onFinish });

    await vi.waitFor(() => expect(onAbort).toHaveBeenCalledTimes(1));
    expect(onFinish).not.toHaveBeenCalled();
    expect(llm.getRequests()).toHaveLength(2);

    const payload = onAbort.mock.calls[0]![0];
    expect(payload.steps[0]?.usage).toMatchObject({ inputTokens: 10, outputTokens: 20, totalTokens: 30 });
    expect(REPLY.startsWith(payload.text)).toBe(true);
    expect(payload.text.length).toBeGreaterThan(0);
  });

  it('cancelling a streaming reply does not call onError', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: REPLY }, slowStream);
    const { agent } = await createSharedAgent(llm, { engine });
    const onAbort = vi.fn();
    const onError = vi.fn();

    const { deltas } = await streamAndAbortOnFirstText(agent, { onAbort, onError });

    expect(deltas.join('').length).toBeLessThan(REPLY.length);
    await vi.waitFor(() => expect(onAbort).toHaveBeenCalledTimes(1));
    // Give a late onError (fired after onAbort) the chance to land before asserting.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onError).not.toHaveBeenCalled();
  });

  it('cancelling the second model call does not call onError', async () => {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_step', name: 'step', arguments: {} }] },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: REPLY }, slowStream);
    const step = createTool({
      id: 'step',
      description: 'Take a step',
      inputSchema: z.object({}),
      execute: async () => 'done',
    });
    const { agent } = await createSharedAgent(llm, { engine, tools: { step } });
    const onAbort = vi.fn();
    const onError = vi.fn();

    await streamAndAbortOnFirstText(agent, { onAbort, onError });

    await vi.waitFor(() => expect(onAbort).toHaveBeenCalledTimes(1));
    expect(llm.getRequests()).toHaveLength(2);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onError).not.toHaveBeenCalled();
  });

  it('a provider failure fires onError and skips onFinish', async () => {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat' },
      { error: { message: 'Terminal provider failure', type: 'invalid_request_error' }, status: 400 },
    );
    const { agent } = await createSharedAgent(llm, { engine });
    const onError = vi.fn();
    const onFinish = vi.fn();

    const result = await agent.stream('Go', { maxSteps: 5, onError, onFinish });
    const output = isDurableEngineVariant(engine) ? result.output : result;
    await output.consumeStream().catch(() => undefined);
    result.cleanup?.();

    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onFinish).not.toHaveBeenCalled();
  });
});
