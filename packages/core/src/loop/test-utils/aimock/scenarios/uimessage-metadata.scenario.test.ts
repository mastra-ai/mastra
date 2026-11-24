/**
 * AIMock Scenario: UI messages with metadata
 *
 * Users pass AI SDK UI messages (`role`, `content`, `parts`, `metadata`) to
 * `stream()` / `generate()`. Every engine must:
 * - send the message text to the model, whether it came as a string or as parts
 * - persist each message's `metadata` to memory exactly as given (nested
 *   objects, unicode keys, null / 0 / false / '' values), and persist no
 *   metadata for a message that had none
 * - forward an assistant history message (and its text) to the model
 */

import { expect, it } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

const RESOURCE = 'customer-12345';

const RICH_METADATA = {
  source: 'web-ui',
  context: { orderId: 'ORDER-789', status: 'pending', tags: ['vip', 'priority'] },
  'unicode-ключ': 'значение ✓',
  quotes: 'He said "hi" & <left>',
  nullable: null,
  zero: 0,
  flag: false,
  empty: '',
};

describeForAllEngines('AIMock loop scenario: UI messages with metadata', engine => {
  const getMock = useLoopScenarioAimock();

  async function setup(thread: string) {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'Response acknowledging metadata' });
    const memory = new MockMemory();
    const { agent } = await createSharedAgent(llm, { engine, memory });
    return { llm, memory, agent, memoryOption: { memory: { resource: RESOURCE, thread: thread } } };
  }

  async function streamText(agent: any, messages: unknown[], options: unknown) {
    const result = await agent.stream(messages, options);
    const output = isDurableEngineVariant(engine) ? result.output : result;
    const text = await output.text;
    result.cleanup?.();
    return text;
  }

  async function storedUserMessages(memory: MockMemory, threadId: string) {
    const { messages } = await memory.recall({ threadId, resourceId: RESOURCE, perPage: 20 });
    return messages.filter(message => message.role === 'user');
  }

  it('stream() sends the text to the model and persists nested and edge-case metadata unchanged', async () => {
    const { llm, memory, agent, memoryOption } = await setup('uimessage-stream');
    const messages = [
      {
        role: 'user' as const,
        content: 'Hello with metadata',
        parts: [{ type: 'text' as const, text: 'Hello with metadata' }],
        metadata: RICH_METADATA,
      },
    ];

    expect(await streamText(agent, messages, memoryOption)).toBe('Response acknowledging metadata');

    expect(llm.getRequests()[0]!.body!.messages.at(-1)).toMatchObject({ role: 'user', content: 'Hello with metadata' });
    const [user] = await storedUserMessages(memory, 'uimessage-stream');
    expect(user!.content.metadata).toEqual(RICH_METADATA);
  });

  it('generate() persists metadata per message and none for a message without it', async () => {
    const { llm, memory, agent, memoryOption } = await setup('uimessage-generate-mixed');
    const messages = [
      {
        role: 'user' as const,
        content: 'First message with metadata',
        parts: [{ type: 'text' as const, text: 'First message with metadata' }],
        metadata: { messageType: 'initial', priority: 'high' },
      },
      {
        role: 'user' as const,
        content: 'Second message without metadata',
        parts: [{ type: 'text' as const, text: 'Second message without metadata' }],
      },
    ];

    const result = await agent.generate(messages, memoryOption);
    expect(result.text).toBe('Response acknowledging metadata');

    const sent = JSON.stringify(llm.getRequests()[0]!.body!.messages);
    expect(sent).toContain('First message with metadata');
    expect(sent).toContain('Second message without metadata');

    const users = await storedUserMessages(memory, 'uimessage-generate-mixed');
    const first = users.find(message => JSON.stringify(message.content).includes('First message'));
    const second = users.find(message => JSON.stringify(message.content).includes('Second message'));
    expect(first!.content.metadata).toEqual({ messageType: 'initial', priority: 'high' });
    expect(second!.content.metadata).toBeUndefined();
  });

  it('text given only as parts, and as a plain string, both reach the model', async () => {
    const { llm, agent, memoryOption } = await setup('uimessage-content-forms');
    const messages = [
      {
        role: 'user' as const,
        content: '',
        parts: [
          { type: 'text' as const, text: 'PARTS_ONE' },
          { type: 'text' as const, text: 'PARTS_TWO' },
        ],
        metadata: { form: 'parts' },
      },
      { role: 'user' as const, content: 'STRING_CONTENT', metadata: { form: 'string' } },
    ];

    expect(await streamText(agent, messages, memoryOption)).toBe('Response acknowledging metadata');

    const sent = JSON.stringify(llm.getRequests()[0]!.body!.messages);
    expect(sent).toContain('PARTS_ONE');
    expect(sent).toContain('PARTS_TWO');
    expect(sent).toContain('STRING_CONTENT');
  });

  it('an assistant history message with metadata is forwarded to the model as an assistant turn', async () => {
    const { llm, agent, memoryOption } = await setup('uimessage-assistant-history');
    const messages = [
      { role: 'user' as const, content: 'What is 2+2?' },
      {
        role: 'assistant' as const,
        content: 'PRIOR_ANSWER_FOUR',
        parts: [{ type: 'text' as const, text: 'PRIOR_ANSWER_FOUR' }],
        metadata: { modelUsed: 'gpt-4', tokensUsed: 150 },
      },
      { role: 'user' as const, content: 'And times 3?' },
    ];

    expect(await streamText(agent, messages, memoryOption)).toBe('Response acknowledging metadata');

    const sent = llm.getRequests()[0]!.body!.messages.filter((message: any) => message.role !== 'system');
    expect(sent.map((message: any) => message.role)).toEqual(['user', 'assistant', 'user']);
    expect(JSON.stringify(sent[1]!.content)).toContain('PRIOR_ANSWER_FOUR');
    expect(sent[2]).toMatchObject({ role: 'user', content: 'And times 3?' });
  });
});
