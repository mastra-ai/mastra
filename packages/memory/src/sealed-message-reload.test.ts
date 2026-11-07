import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { MessageHistory } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { ObservationalMemory } from './processors/observational-memory/observational-memory';
import { Memory } from './index';

const threadId = 'sealed-reload-thread';
const resourceId = 'sealed-reload-user';

async function createMemory() {
  const memory = new Memory({
    storage: new InMemoryStore(),
    options: { generateTitle: false, semanticRecall: false },
  });
  await memory.createThread({ threadId, resourceId });
  return memory;
}

function assistantMessage({ text, sealed }: { text: string; sealed: boolean }): MastraDBMessage {
  return {
    id: 'assistant-message',
    role: 'assistant',
    threadId,
    resourceId,
    createdAt: new Date(0),
    content: {
      format: 2,
      ...(sealed ? { metadata: { mastra: { sealed: true } } } : {}),
      parts: [
        {
          type: 'reasoning',
          reasoning: '',
          details: [{ type: 'text', text: '' }],
          providerMetadata: { openai: { itemId: 'rs_example' } },
        },
        { type: 'text', text },
      ],
    },
  };
}

function reasoningItemIds(list: MessageList) {
  return list.get.all
    .db()
    .flatMap(message =>
      message.content.parts.flatMap(part => (part.type === 'reasoning' ? [part.providerMetadata?.openai?.itemId] : [])),
    );
}

/**
 * Saves the live message through Memory, reads it back from storage, and adds the
 * stored copy to the live list the way memory recall does on resume.
 */
async function reloadFromMemory({ live, saved }: { live: MastraDBMessage; saved: MastraDBMessage }) {
  const memory = await createMemory();
  const list = new MessageList({ threadId, resourceId }).add(structuredClone(live), 'response');
  await memory.saveMessages({ messages: [saved] });
  const { messages: recalled } = await memory.recall({ threadId, resourceId });
  list.add(recalled, 'memory');
  return { list, recalled };
}

// Memory trims text when it persists a message, so the stored copy of a sealed message
// ending in a newline differs from the live one. On resume the list treated that copy
// as new content and appended it under a new id with the same OpenAI item ids, and the
// Responses API rejected the request with "Duplicate item found with id rs_...". (#29380)
describe('Reloading a sealed assistant message from memory (#29380)', () => {
  it('keeps one message and one reasoning item when the stored copy was trimmed', async () => {
    const live = assistantMessage({ text: 'hello\n', sealed: true });
    const { list, recalled } = await reloadFromMemory({ live, saved: live });

    // The stored copy really was normalized: this is the case under test.
    expect(recalled).toHaveLength(1);
    expect(recalled[0]!.content.parts.find(part => part.type === 'text')).toMatchObject({ text: 'hello' });

    const messages = list.get.all.db();
    expect(messages.map(message => message.id)).toEqual(['assistant-message']);
    expect(reasoningItemIds(list)).toEqual(['rs_example']);
  });

  it('sends the reasoning item to the model once after the reload', async () => {
    const live = assistantMessage({ text: 'hello\n', sealed: true });
    const { list } = await reloadFromMemory({ live, saved: live });

    const prompt = JSON.stringify(await list.get.all.aiV5.llmPrompt());
    expect(prompt.match(/rs_example/g)).toHaveLength(1);
  });

  it('stays deduplicated across repeated reloads of the same thread', async () => {
    const memory = await createMemory();
    const live = assistantMessage({ text: 'hello\n', sealed: true });
    const list = new MessageList({ threadId, resourceId }).add(structuredClone(live), 'response');
    await memory.saveMessages({ messages: [live] });

    for (let reload = 0; reload < 2; reload++) {
      const { messages: recalled } = await memory.recall({ threadId, resourceId });
      list.add(recalled, 'memory');
    }

    expect(list.get.all.db()).toHaveLength(1);
    expect(reasoningItemIds(list)).toEqual(['rs_example']);
  });

  it('keeps one message when a sealed message needed no trimming', async () => {
    const live = assistantMessage({ text: 'hello', sealed: true });
    const { list } = await reloadFromMemory({ live, saved: live });

    expect(list.get.all.db()).toHaveLength(1);
    expect(reasoningItemIds(list)).toEqual(['rs_example']);
  });

  it('keeps one message when an unsealed message was trimmed', async () => {
    const live = assistantMessage({ text: 'hello\n', sealed: false });
    const { list } = await reloadFromMemory({ live, saved: live });

    expect(list.get.all.db()).toHaveLength(1);
    expect(reasoningItemIds(list)).toEqual(['rs_example']);
  });

  // Memory also strips working-memory tool steps and <working_memory> tags when it saves,
  // which made the same duplicate without any whitespace to trim.
  it('keeps one message when the stored copy lost a working-memory tool step', async () => {
    const live: MastraDBMessage = {
      ...assistantMessage({ text: 'hello', sealed: true }),
      content: {
        format: 2,
        metadata: { mastra: { sealed: true } },
        parts: [
          { type: 'step-start' },
          {
            type: 'reasoning',
            reasoning: '',
            details: [{ type: 'text', text: 'update memory' }],
            providerMetadata: { openai: { itemId: 'rs_memory_step' } },
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'call-working-memory',
              toolName: 'updateWorkingMemory',
              args: { memory: 'likes tea' },
              result: { success: true },
            },
          },
          { type: 'step-start' },
          {
            type: 'reasoning',
            reasoning: '',
            details: [{ type: 'text', text: 'answer' }],
            providerMetadata: { openai: { itemId: 'rs_example' } },
          },
          { type: 'text', text: 'hello' },
        ],
      },
    };
    const { list, recalled } = await reloadFromMemory({ live, saved: live });

    expect(JSON.stringify(recalled)).not.toContain('updateWorkingMemory');
    expect(list.get.all.db().map(message => message.id)).toEqual(['assistant-message']);
    expect(reasoningItemIds(list)).toEqual(['rs_memory_step', 'rs_example']);
  });

  it('keeps one message when the stored copy lost working-memory tags', async () => {
    const live = assistantMessage({ text: 'hello <working_memory>likes tea</working_memory>', sealed: true });
    const { list, recalled } = await reloadFromMemory({ live, saved: live });

    expect(recalled[0]!.content.parts.find(part => part.type === 'text')).toMatchObject({ text: 'hello' });
    expect(list.get.all.db().map(message => message.id)).toEqual(['assistant-message']);
    expect(reasoningItemIds(list)).toEqual(['rs_example']);
  });

  // Technical: a client can send back an assistant message whose tool call was still streaming
  // (AI SDK `input-streaming`, stored as `partial-call`). Observational memory seals it and saves
  // it through MessageHistory, which drops partial calls, so the stored copy has one part fewer
  // than the live message. (#29380)
  it('keeps one message when observational memory saved a sealed message without its streaming tool call', async () => {
    const memory = await createMemory();
    const list = new MessageList({ threadId, resourceId }).add(
      {
        id: 'assistant-message',
        role: 'assistant',
        parts: [
          { type: 'reasoning', text: '', providerMetadata: { openai: { itemId: 'rs_example' } } },
          { type: 'text', text: 'Looking that up.' },
          {
            type: 'dynamic-tool',
            toolName: 'lookup',
            toolCallId: 'call-lookup',
            state: 'input-streaming',
            input: { a: 17 },
          },
        ],
      },
      'input',
    );
    const live = list.get.all.db();
    expect(JSON.stringify(live)).toContain('partial-call');

    // Seal and save the way observational memory's async buffering does.
    const store = await memory.storage.getStore('memory');
    if (!store) throw new Error('InMemoryStore has no memory domain');
    const om = new ObservationalMemory({
      storage: store,
      scope: 'thread',
      observation: { model: 'openai/gpt-4o-mini', messageTokens: 1000, bufferTokens: 200 },
      reflection: { model: 'openai/gpt-4o-mini', observationTokens: 2000 },
    });
    om.sealMessagesForBuffering(live);
    await new MessageHistory({ storage: store }).persistMessages({ messages: live, threadId, resourceId });

    const { messages: recalled } = await memory.recall({ threadId, resourceId });
    // The stored copy really lost the streaming tool call: this is the case under test.
    expect(recalled[0]!.content.parts.map(part => part.type)).toEqual(['reasoning', 'text']);
    list.add(recalled, 'memory');

    expect(list.get.all.db().map(message => message.id)).toEqual(['assistant-message']);
    expect(reasoningItemIds(list)).toEqual(['rs_example']);
  });

  it('still adds text that changed after the seal as a new message', async () => {
    const live = assistantMessage({ text: 'hello\n', sealed: true });
    const saved = assistantMessage({ text: 'hello, and more text written after the seal\n', sealed: true });
    const { list } = await reloadFromMemory({ live, saved });

    const messages = list.get.all.db();
    expect(messages).toHaveLength(2);
    expect(messages[0]!.id).toBe('assistant-message');
    expect(messages[1]!.id).not.toBe('assistant-message');
    expect(messages[1]!.content.parts.find(part => part.type === 'text')).toMatchObject({
      text: 'hello, and more text written after the seal',
    });
  });
});
