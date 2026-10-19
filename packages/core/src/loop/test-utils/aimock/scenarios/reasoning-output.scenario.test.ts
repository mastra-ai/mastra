import { it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  runLoopScenario,
  useLoopScenarioAimock,
} from '../aimock-scenario';

/**
 * Reasoning output and replay across engines.
 *
 * Moved from durable-agent-reasoning (which only asserted prepare() returned a
 * runId) and reasoning-client-echo (#24052, a MockLanguageModelV2 prompt check).
 *
 * The scenario model is the OpenAI Responses provider. AIMock streams
 * `reasoning` as a reasoning output item, so the provider emits real
 * reasoning-start/delta/end parts with `rs_*` / `msg_*` item ids. On the next
 * turn the provider sends stored assistant items as `item_reference`s, which
 * AIMock's journal normalizes to `{ role: 'assistant', content: '' }`. So one
 * placeholder per stored item, in order, is what the next request must show:
 * reasoning item first, then its message item. Dropping the reasoning part
 * leaves a single placeholder (OpenAI rejects an orphaned `msg_*` reference).
 */

const ITEM_REFERENCE = { role: 'assistant', content: '' };

function history(request: { body: any }) {
  return request.body.messages.filter((m: any) => m.role !== 'system');
}

describeForAllEngines('AIMock loop scenario: reasoning output', engine => {
  const getMock = useLoopScenarioAimock();

  it('streams reasoning separately from text and persists both parts in order', async () => {
    const memory = new MockMemory();
    const threadId = 'reasoning-thread';
    const resourceId = 'reasoning-user';

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What is 6 times 7?',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'The answer is 42.', reasoning: 'Six sevens are forty-two.' });
      },
    });

    expect(await output.text).toBe('The answer is 42.');
    expect(await output.reasoningText).toBe('Six sevens are forty-two.');
    expect(requests).toHaveLength(1);

    const { messages } = await memory.recall({ threadId, resourceId });
    const assistant = messages.filter(m => m.role === 'assistant').flatMap(m => m.content.parts);
    expect(assistant.map(p => p.type)).toEqual(['reasoning', 'text']);
    expect(assistant[0]).toMatchObject({ details: [{ type: 'text', text: 'Six sevens are forty-two.' }] });
    expect(assistant[1]).toMatchObject({ text: 'The answer is 42.' });
  });

  it('replays the stored reasoning item ahead of its message item on the next turn', async () => {
    const memory = new MockMemory();
    const threadId = 'reasoning-history-thread';
    const resourceId = 'reasoning-user';

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What is 6 times 7?',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'The answer is 42.', reasoning: 'Six sevens are forty-two.' });
      },
    });

    getMock().clearRequests();
    getMock().clearFixtures();
    getMock().resetMatchCounts();

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'And doubled?',
      memory,
      threadId,
      resourceId,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: '84.' });
      },
    });

    expect(await output.text).toBe('84.');
    expect(history(requests[0]!)).toEqual([
      { role: 'user', content: 'What is 6 times 7?' },
      ITEM_REFERENCE,
      ITEM_REFERENCE,
      { role: 'user', content: 'And doubled?' },
    ]);
  });

  // #24052: a useChat client echoes the assistant message back by id without
  // its reasoning part. The stored copy must win, in the prompt and in storage.
  for (const echoKeepsItemId of [true, false]) {
    it(`keeps stored reasoning when a client echoes the answer without it (echo keeps itemId: ${echoKeepsItemId})`, async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat', userMessage: 'q1' }, { content: 'Hi.', reasoning: 'Thinking about q1.' });
      llm.on({ endpoint: 'chat', userMessage: 'q2' }, { content: 'Second.' });

      const memory = new MockMemory();
      const { agent } = await createSharedAgent(llm, { engine, memory });
      const threadId = `echo-thread-${echoKeepsItemId}`;
      const memoryOptions = { memory: { thread: threadId, resource: 'r', options: { lastMessages: 10 } } };
      const send = async (messages: any[]) => {
        const result: any = await agent.stream(messages, memoryOptions);
        const output = isDurableEngineVariant(engine) ? result.output : result;
        const text = await output.text;
        result.cleanup?.();
        return text;
      };

      const q1 = { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'q1' }] };
      expect(await send([q1])).toBe('Hi.');

      const before = await memory.recall({ threadId, resourceId: 'r' });
      const stored = before.messages.find(m => m.role === 'assistant')!;
      const storedShape = stored.content.parts.map(p => p.type);
      expect(storedShape).toEqual(['reasoning', 'text']);
      const textMetadata = stored.content.parts[1]!.providerMetadata;

      const echoed = {
        id: stored.id,
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hi.', ...(echoKeepsItemId ? { providerMetadata: textMetadata } : {}) }],
      };
      const q2 = { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'q2' }] };
      expect(await send([q1, echoed, q2])).toBe('Second.');

      const requests = llm.getRequests();
      expect(history(requests[1]!)).toEqual([
        { role: 'user', content: 'q1' },
        ITEM_REFERENCE,
        ITEM_REFERENCE,
        { role: 'user', content: 'q2' },
      ]);

      const after = await memory.recall({ threadId, resourceId: 'r', perPage: 100 });
      const persisted = after.messages.find(m => m.id === stored.id)!;
      expect(persisted.content.parts.map(p => p.type)).toEqual(storedShape);
      expect(persisted.content.parts[0]).toMatchObject({ details: [{ type: 'text', text: 'Thinking about q1.' }] });
    });
  }
});
