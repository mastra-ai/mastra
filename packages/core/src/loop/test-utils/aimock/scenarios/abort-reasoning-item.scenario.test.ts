import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * A user aborts a reply after the model has streamed part of a response (#31202).
 *
 * OpenAI only keeps the items of a response that finished. If memory stores an
 * item id from the aborted response, the next turn sends it as an
 * `item_reference` and OpenAI fails that turn, and every later one, with
 * "Item with id 'rs_…' not found". AIMock's journal shows each `item_reference`
 * as `{ role: 'assistant', content: '' }`, so the next request must only carry
 * placeholders for items of finished responses.
 */

const ITEM_REFERENCE = { role: 'assistant', content: '' };
const THREAD = { thread: 'abort-item-thread', resource: 'abort-item-user' };
const slowStream = { chunkSize: 4, latency: 20 };

const lookup = createTool({
  id: 'lookup',
  description: 'Look something up',
  inputSchema: z.object({ q: z.string() }),
  execute: async ({ q }) => ({ found: q }),
});

function history(request: { body: any }) {
  return request.body.messages.filter((m: any) => m.role !== 'system');
}

describeForAllEngines('AIMock loop scenario: abort keeps no item ids of the unfinished response', engine => {
  const getMock = useLoopScenarioAimock();

  async function streamAndAbort(agent: any, shouldAbort: (chunk: any) => boolean) {
    const controller = new AbortController();
    const result = await agent.stream('start', { maxSteps: 5, abortSignal: controller.signal, memory: THREAD });
    const output = result.output ?? result;
    try {
      for await (const chunk of output.fullStream) {
        if (shouldAbort(chunk)) controller.abort();
      }
    } catch {
      // Durable streams can reject with AbortError after the abort chunk.
    }
    result.cleanup?.();
  }

  async function nextTurn(agent: any) {
    const llm = getMock();
    llm.clearRequests();
    const result = await agent.stream('next', { memory: THREAD });
    expect(await (result.output ?? result).text).toBe('Done.');
    expect(llm.getRequests()).toHaveLength(1);
    return history(llm.getRequests()[0]!);
  }

  it('does not replay the reasoning of a step aborted while its tool call streams', async () => {
    const llm = getMock();
    const memory = new MockMemory();
    llm.on(
      { endpoint: 'chat', userMessage: 'start', sequenceIndex: 0 },
      { reasoning: 'First I look it up.', content: '', toolCalls: [{ name: 'lookup', arguments: '{"q":"a"}' }] },
    );
    llm.on(
      { endpoint: 'chat', userMessage: 'start', sequenceIndex: 1 },
      {
        reasoning: 'Now a second lookup.',
        content: '',
        toolCalls: [{ name: 'lookup', arguments: JSON.stringify({ q: 'b'.repeat(400) }) }],
      },
      slowStream,
    );
    llm.on({ endpoint: 'chat', userMessage: 'next' }, { content: 'Done.' });
    const { agent } = await createSharedAgent(llm, { engine, memory, tools: { lookup } });

    let reasoningEnds = 0;
    await streamAndAbort(agent, chunk => {
      if (chunk.type === 'reasoning-end') reasoningEnds++;
      return reasoningEnds === 2 && chunk.type === 'tool-call-delta';
    });

    // The finished first step is referenced (reasoning item, then its tool call);
    // nothing of the aborted second step follows the tool result.
    const messages = await nextTurn(agent);
    expect(messages.map((m: any) => m.role)).toEqual(['user', 'assistant', 'assistant', 'tool', 'user']);
    expect(messages[1]).toEqual(ITEM_REFERENCE);
    expect(messages.at(-1)).toMatchObject({ role: 'user', content: 'next' });
  });

  it('sends the partial text of an aborted reply inline instead of as an item reference', async () => {
    const llm = getMock();
    const memory = new MockMemory();
    llm.on(
      { endpoint: 'chat', userMessage: 'start' },
      { reasoning: 'Thinking.', content: 'Here is a long answer that the user cancels before it finishes.' },
      slowStream,
    );
    llm.on({ endpoint: 'chat', userMessage: 'next' }, { content: 'Done.' });
    const { agent } = await createSharedAgent(llm, { engine, memory });

    await streamAndAbort(agent, chunk => chunk.type === 'text-delta');

    const messages = await nextTurn(agent);
    expect(messages).not.toContainEqual(ITEM_REFERENCE);
    expect(messages.at(-1)).toMatchObject({ role: 'user', content: 'next' });
  });
});
