import { stepCountIs } from '@internal/ai-sdk-v5';
import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { StreamErrorRetryProcessor } from '../../../../processors';
import { createTool } from '../../../../tools';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * A support agent's reply is cut off by a dropped connection. The default error processors retry
 * the step, and the customer gets a complete answer. What gets saved to the thread must be that
 * answer alone: if the half-written attempt stays in the stored message, every reload shows the
 * reply twice and the next turn sends the broken fragment back to the model.
 *
 * The failure is real at the HTTP layer: aimock streams a few text deltas, then resets the socket
 * (`disconnectAfterMs`). `truncateAfterChunks` is not used here: it resets before any byte is sent,
 * which is a connection error, not a mid-stream failure.
 */

const CUT_OFF_REPLY = 'Your order shipped yesterday and should arrive by Friday, tracking number';
const FULL_REPLY = 'Your order #4821 shipped yesterday and arrives Friday.';
const midStreamDrop = { chunkSize: 5, latency: 20, disconnectAfterMs: 150 };
// Same processor id as the shipped default, so it replaces it; the default waits 3s before retrying.
const retryWithoutBackoff = () => [new StreamErrorRetryProcessor({ maxRetries: 2 })];

const lookupOrder = createTool({
  id: 'lookupOrder',
  description: 'Look up an order by id.',
  inputSchema: z.object({ orderId: z.string() }),
  execute: async ({ orderId }) => ({ orderId, status: 'shipped' }),
});

async function savedAssistantText(memory: MockMemory, threadId: string) {
  const { messages } = await memory.recall({ threadId, resourceId: 'customer-4821' });
  return messages
    .filter(m => m.role === 'assistant')
    .flatMap(m => m.content.parts)
    .filter(p => p.type === 'text')
    .map(p => p.text);
}

describeForAllEngines('Support agent reply interrupted by a dropped connection', engine => {
  const getMock = useLoopScenarioAimock();

  // Technical: when the model stream errors after text deltas and an error processor returns
  // { retry: true }, the step retries in place. The failed attempt's parts were already added to
  // the MessageList as response parts with the same messageId, so the retried attempt merged into
  // that message: partial text + step-start + full text. Fixed by rolling back to the iteration's
  // step boundary before the retry (#26654). (#26857)
  it('a reply cut off mid-sentence is retried and only the complete reply is saved (#26857)', async () => {
    const memory = new MockMemory();

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Where is my order #4821?',
      memory,
      threadId: 'thread-26857',
      resourceId: 'customer-4821',
      errorProcessors: retryWithoutBackoff(),
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: CUT_OFF_REPLY }, midStreamDrop);
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: FULL_REPLY });
      },
    });

    // Guard: the first attempt really streamed partial text before it failed.
    const deltas = chunks!.filter(c => c.type === 'text-delta').map(c => c.payload.text);
    expect(deltas.length).toBeGreaterThan(1);
    expect(CUT_OFF_REPLY.startsWith(deltas[0]!)).toBe(true);

    expect(await output.text).toBe(FULL_REPLY);
    expect(getMock().getRequests()).toHaveLength(2);
    expect(await savedAssistantText(memory, 'thread-26857')).toEqual([FULL_REPLY]);
  });

  // Technical: same failure on a later loop iteration. Rolling back must stop at this
  // iteration's step boundary and keep the earlier tool step (call + result) in the message.
  it('a reply cut off after an order lookup keeps the lookup and saves only the complete reply', async () => {
    const memory = new MockMemory();
    let toolRuns = 0;
    const countingLookup = createTool({
      ...lookupOrder,
      execute: async input => {
        toolRuns += 1;
        return lookupOrder.execute!(input, {} as never);
      },
    });

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Where is my order #4821?',
      tools: { lookupOrder: countingLookup },
      stopWhen: stepCountIs(5),
      memory,
      threadId: 'thread-26857-tool',
      resourceId: 'customer-4821',
      errorProcessors: retryWithoutBackoff(),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ name: 'lookupOrder', arguments: JSON.stringify({ orderId: '4821' }) }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true, sequenceIndex: 0 }, { content: CUT_OFF_REPLY }, midStreamDrop);
        llm.on({ endpoint: 'chat', hasToolResult: true, sequenceIndex: 1 }, { content: FULL_REPLY });
      },
    });

    expect(await output.text).toBe(FULL_REPLY);
    expect(toolRuns).toBe(1);
    expect(await savedAssistantText(memory, 'thread-26857-tool')).toEqual([FULL_REPLY]);
    const { messages } = await memory.recall({ threadId: 'thread-26857-tool', resourceId: 'customer-4821' });
    expect(JSON.stringify(messages)).toContain('"toolName":"lookupOrder"');
  });
});
