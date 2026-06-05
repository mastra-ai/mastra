import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';

import { ProviderHistoryCompat } from '../../../processors/provider-history-compat';
import { AIV5Adapter } from '../adapters/AIV5Adapter';
import { MessageList } from '../index';

const anthropicThinkingPart = {
  type: 'reasoning' as const,
  text: 'I should preserve this thinking exactly.',
  providerOptions: {
    anthropic: {
      signature: 'sig-anthropic-thinking',
    },
  },
};

function getAssistantReasoningParts(prompt: LanguageModelV2Prompt) {
  return prompt
    .filter(message => message.role === 'assistant')
    .flatMap(message => (Array.isArray(message.content) ? message.content : []))
    .filter((part): part is typeof anthropicThinkingPart => part.type === 'reasoning');
}

describe('Anthropic signed thinking round-trip', () => {
  it('persists and replays Anthropic thinking text with its signature', () => {
    const dbMessage = AIV5Adapter.fromModelMessage({
      id: 'msg-anthropic-thinking',
      role: 'assistant',
      content: [anthropicThinkingPart, { type: 'text', text: 'Done.' }],
    });

    expect(dbMessage.content.parts[0]).toMatchObject({
      type: 'reasoning',
      reasoning: anthropicThinkingPart.text,
      details: [{ type: 'text', text: anthropicThinkingPart.text }],
      providerMetadata: anthropicThinkingPart.providerOptions,
    });

    const list = new MessageList();
    list.add({ role: 'user', content: 'Think briefly.' }, 'input');
    list.add(dbMessage, 'memory');
    list.add({ role: 'user', content: 'Continue.' }, 'input');

    const reasoning = getAssistantReasoningParts(list.get.all.aiV5.prompt());
    expect(reasoning).toHaveLength(1);
    expect(reasoning[0]).toEqual(anthropicThinkingPart);
  });

  it('keeps signed Anthropic thinking valid through multi-turn replay processing', async () => {
    const list = new MessageList();
    list.add({ role: 'user', content: 'Think briefly.' }, 'input');
    list.add(
      AIV5Adapter.fromModelMessage({
        id: 'msg-anthropic-thinking',
        role: 'assistant',
        content: [anthropicThinkingPart, { type: 'text', text: 'Done.' }],
      }),
      'memory',
    );
    list.add({ role: 'user', content: 'Use that context.' }, 'input');

    const prompt = list.get.all.aiV5.prompt();
    const result = await new ProviderHistoryCompat().processLLMRequest({
      prompt,
      model: { provider: 'anthropic.messages' },
      stepNumber: 0,
      steps: [],
      state: {},
      retryCount: 0,
      abort: (() => {
        throw new Error('abort');
      }) as any,
    });

    const processedPrompt = result?.prompt ?? prompt;
    expect(getAssistantReasoningParts(processedPrompt)).toEqual([anthropicThinkingPart]);
  });

  it('does not forward legacy empty Anthropic thinking with a non-empty signature', async () => {
    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'Hi' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: '',
            providerOptions: { anthropic: { signature: 'sig-without-thinking-text' } },
          },
          { type: 'text', text: 'Hello.' },
        ],
      },
    ];

    const result = await new ProviderHistoryCompat().processLLMRequest({
      prompt,
      model: { provider: 'anthropic.messages' },
      stepNumber: 0,
      steps: [],
      state: {},
      retryCount: 0,
      abort: (() => {
        throw new Error('abort');
      }) as any,
    });

    expect(result).toEqual({ prompt: expect.any(Array) });
    const assistant = result!.prompt.find(message => message.role === 'assistant')!;
    expect(Array.isArray(assistant.content)).toBe(true);
    expect((assistant.content as any[]).map(part => part.type)).toEqual(['text']);
  });

  it('does not change Gemini provider metadata on non-Anthropic replay', async () => {
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'assistant',
        content: [
          {
            type: 'file',
            data: 'data:image/png;base64,abcd',
            mediaType: 'image/png',
            providerOptions: { google: { thoughtSignature: 'gemini-sig' } },
          },
        ],
      },
    ];

    const result = await new ProviderHistoryCompat().processLLMRequest({
      prompt,
      model: { provider: 'google.generative-ai' },
      stepNumber: 0,
      steps: [],
      state: {},
      retryCount: 0,
      abort: (() => {
        throw new Error('abort');
      }) as any,
    });

    expect(result).toBeUndefined();
    expect((prompt[0]!.content as any[])[0].providerOptions.google.thoughtSignature).toBe('gemini-sig');
  });
});
