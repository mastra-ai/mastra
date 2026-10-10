import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { ChatResult } from '@langchain/core/outputs';
import { createDeepAgent } from 'deepagents';
import { describe, expect, it } from 'vitest';

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
    this.prompts.push(messages.map(m => m.text));
    const message = this.replies.shift()!;
    return { generations: [{ message, text: message.text }] };
  }
}

function fakeClient() {
  const saved: { messages: { role: string; parts?: { type: string; text?: string }[] }[] }[] = [];
  const client = {
    getContext: async () => ({
      system: '<observations>Ada lives in Kyoto.</observations>',
      messages: [],
      observedAt: null,
    }),
    saveMessages: async (_threadId: string, body: (typeof saved)[number]) => {
      saved.push(body);
      return { messages: [] };
    },
    getObservationStatus: async () => ({ shouldObserve: false }),
    observe: async () => ({ observed: false, reflected: false, record: null }),
  } as unknown as PlatformMemoryClient;
  return { client, saved };
}

describe('platformMemoryAgentMiddleware with Deep Agents', () => {
  it('gives the main agent memory and saves its turn', async () => {
    const model = new ScriptedModel([new AIMessage('You live in Kyoto.')]);
    const { client, saved } = fakeClient();
    const agent = createDeepAgent({ model, middleware: [platformMemoryAgentMiddleware({ client })] });
    await agent.invoke(
      { messages: [{ role: 'user', content: 'Where do I live?' }] },
      { configurable: { thread_id: 't1' } },
    );

    expect(model.prompts[0]!.join('\n')).toContain('Ada lives in Kyoto.');
    expect(saved.at(-1)!.messages.map(m => m.role)).toEqual(['user', 'assistant']);
  });

  it('leaves forked subagents out of the parent thread', async () => {
    const model = new ScriptedModel([
      new AIMessage({
        content: '',
        tool_calls: [{ id: 'task-1', name: 'task', args: { subagent_type: 'helper', description: 'Draft a haiku' } }],
      }),
      new AIMessage('subagent internal answer'),
      new AIMessage('Here is your haiku.'),
    ]);
    const { client, saved } = fakeClient();
    const memory = platformMemoryAgentMiddleware({ client });
    const agent = createDeepAgent({
      model,
      middleware: [memory],
      subagents: [{ name: 'helper', description: 'Helps', mode: 'fork', middleware: [memory] }],
    });
    await agent.invoke(
      { messages: [{ role: 'user', content: 'Write a haiku' }] },
      { configurable: { thread_id: 't1' } },
    );

    // The subagent's prompt is its own forked transcript, not rewritten from parent memory.
    expect(model.prompts[1]!.join('\n')).not.toContain('Ada lives in Kyoto.');
    // Only the parent's turn is saved: one user message, and the subagent's internal reply never lands as its own message.
    const last = saved.at(-1)!.messages;
    expect(last.filter(m => m.role === 'user')).toHaveLength(1);
    expect(last.at(-1)!.parts!.some(p => p.text === 'Here is your haiku.')).toBe(true);
    for (const body of saved) {
      expect(
        body.messages.filter(m => m.parts?.some(p => p.text?.includes('Draft a haiku')) && m.role === 'user'),
      ).toEqual([]);
    }
  });
});
