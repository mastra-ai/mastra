import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';
import { tool } from '@langchain/core/tools';
import { createAgent } from 'langchain';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { PlatformMemoryClient } from './client';
import { platformMemoryAgentMiddleware } from './langgraph';

class ScriptedModel extends BaseChatModel {
  prompts: string[][] = [];
  constructor(private replies: AIMessage[]) {
    super({});
  }
  _llmType() {
    return 'scripted';
  }
  bindTools() {
    return this;
  }
  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    this.prompts.push(messages.map(m => m.text || (AIMessage.isInstance(m) ? `call:${m.tool_calls?.[0]?.name}` : '')));
    const message = this.replies.shift()!;
    return { generations: [{ message, text: message.text }] };
  }
}

function fakeClient(shouldObserve = false) {
  const saved: { messages: { id?: string; role: string; parts?: { type: string }[] }[] }[] = [];
  let observed = 0;
  const client = {
    getContext: async () => ({
      system: observed ? '<observations>Ada lives in Kyoto.</observations>' : null,
      messages: [
        { role: 'user', content: 'I like tea' },
        { role: 'assistant', content: 'Noted.' },
      ],
      observedAt: null,
    }),
    saveMessages: async (_threadId: string, body: (typeof saved)[number]) => {
      saved.push(body);
      return { messages: [] };
    },
    getObservationStatus: async () => ({ shouldObserve }),
    observe: async () => {
      observed++;
      return { observed: true, reflected: false, record: null };
    },
  } as unknown as PlatformMemoryClient;
  return { client, saved, observedCount: () => observed };
}

const lookup = tool(async () => 'rows', { name: 'lookup', description: 'Look up', schema: z.object({}) });
const config = { configurable: { thread_id: 't1' } };

function setup(shouldObserve: boolean, replies: AIMessage[]) {
  const model = new ScriptedModel(replies);
  const memory = fakeClient(shouldObserve);
  const agent = createAgent({
    model,
    tools: [lookup],
    systemPrompt: 'You are helpful.',
    middleware: [platformMemoryAgentMiddleware({ client: memory.client })],
  });
  return { agent, model, ...memory };
}

describe('platformMemoryAgentMiddleware', () => {
  it('prepends memory and saves the turn at the end', async () => {
    const { agent, model, saved } = setup(false, [new AIMessage('You live in Kyoto.')]);
    await agent.invoke({ messages: [{ role: 'user', content: 'Where do I live?' }] }, config);

    expect(model.prompts[0]).toEqual(['You are helpful.', 'I like tea', 'Noted.', 'Where do I live?']);
    expect(saved.at(-1)!.messages.map(m => m.role)).toEqual(['user', 'assistant']);
  });

  it('saves the tool loop as it goes and observes mid-loop over threshold', async () => {
    const { agent, model, saved, observedCount } = setup(true, [
      new AIMessage({ content: '', tool_calls: [{ id: 'c1', name: 'lookup', args: {} }] }),
      new AIMessage('Done.'),
    ]);
    await agent.invoke({ messages: [{ role: 'user', content: 'Collect rows' }] }, config);

    expect(observedCount()).toBe(1);
    expect(model.prompts[1]!.join('\n')).toContain('Ada lives in Kyoto.');
    expect(model.prompts[1]).not.toContain('Collect rows');
    const midIds = saved[0]!.messages.map(m => m.id);
    expect(saved.at(-1)!.messages.map(m => m.id)).not.toContain(midIds.at(-1));
    expect(saved[0]!.messages.at(-1)!.parts!.some(p => p.type === 'tool-invocation')).toBe(true);
  });
});
