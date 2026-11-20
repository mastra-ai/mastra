/**
 * AIMock Scenario: results name the trace of their run
 *
 * Code links a score, feedback or a log line to a run through `result.traceId`
 * and `result.spanId`. Every engine must set them on what `stream()`,
 * `generate()`, a resume and `observe()` return, and every chunk must carry the
 * trace ID.
 */

import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';
import { captureOutcomeEvents } from '../outcome-test-utils';

describeForAllEngines('AIMock loop scenario: trace IDs on results', engine => {
  const getMock = useLoopScenarioAimock();
  const isDurable = isDurableEngineVariant(engine);

  async function chunkTypesOffTrace(result: { fullStream: AsyncIterable<ChunkType> }, traceId: string | undefined) {
    const types: string[] = [];
    for await (const chunk of result.fullStream) {
      if ((chunk as { traceId?: string }).traceId !== traceId) types.push(chunk.type);
    }
    return types;
  }

  it('stream and generate results name the agent run span that is exported', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'Done.' });
    const { observability, ended } = captureOutcomeEvents();
    const { agent } = await createSharedAgent(llm, { engine, observability });

    const streamed = await (agent as any).stream('Hello.');
    expect(await chunkTypesOffTrace(streamed, streamed.traceId)).toEqual([]);
    streamed.cleanup?.();
    const generated = await (agent as any).generate('Hello.');

    await vi.waitFor(() =>
      expect(ended().map(span => ({ traceId: span.traceId, spanId: span.id }))).toEqual(
        expect.arrayContaining([
          { traceId: streamed.traceId, spanId: streamed.spanId },
          { traceId: generated.traceId, spanId: generated.spanId },
        ]),
      ),
    );
  });

  async function streamToApproval() {
    const llm = getMock();
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_refund', name: 'refund', arguments: {} }] },
    );
    llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Refunded.' });
    const refund = createTool({
      id: 'refund',
      description: 'Refund the order.',
      inputSchema: z.object({}),
      execute: async () => ({ refunded: true }),
    });
    const { observability, ended } = captureOutcomeEvents();
    const { agent } = await createSharedAgent(llm, { engine, observability, tools: { refund } });

    const first = await (agent as any).stream('Refund my order.', { requireToolApproval: true });
    let toolCallId: string | undefined;
    for await (const chunk of first.fullStream as AsyncIterable<ChunkType>) {
      if (chunk.type !== 'tool-call-approval') continue;
      toolCallId = chunk.payload.toolCallId;
      // Durable streams stay open while suspended; stop at the approval.
      if (isDurable) break;
    }
    expect(first.traceId).toEqual(expect.any(String));
    return { agent: agent as any, first, toolCallId, ended };
  }

  it('a resumed result stays on the trace of the run it resumes', async () => {
    const { agent, first, toolCallId, ended } = await streamToApproval();

    const resumed = isDurable
      ? await agent.resume(first.runId, { approved: true }, { toolCallId })
      : await agent.approveToolCall({ runId: first.runId, toolCallId });
    expect(await chunkTypesOffTrace(resumed, first.traceId)).toEqual([]);
    resumed.cleanup?.();
    first.cleanup?.();

    expect(resumed.traceId).toBe(first.traceId);
    await vi.waitFor(() =>
      expect(ended().map(span => ({ traceId: span.traceId, spanId: span.id }))).toContainEqual({
        traceId: resumed.traceId,
        spanId: resumed.spanId,
      }),
    );
  });

  it.skipIf(!isDurable)('observing a finished run names its trace', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'Done.' });
    const { observability } = captureOutcomeEvents();
    const { agent } = await createSharedAgent(llm, { engine, observability });

    const streamed = await (agent as any).stream('Hello.');
    for await (const _chunk of streamed.fullStream as AsyncIterable<ChunkType>);
    const observed = await (agent as any).observe(streamed.runId);
    expect(await chunkTypesOffTrace(observed, streamed.traceId)).toEqual([]);
    observed.cleanup();
    streamed.cleanup();

    expect(observed.traceId).toBe(streamed.traceId);
  });

  it.skipIf(!isDurable)('observing a run that waits for approval names its trace', async () => {
    const { agent, first } = await streamToApproval();

    const observed = await agent.observe(first.runId);
    observed.cleanup();
    first.cleanup();

    expect(observed.traceId).toBe(first.traceId);
    expect(observed.spanId).toBe(first.spanId);
  });
});
