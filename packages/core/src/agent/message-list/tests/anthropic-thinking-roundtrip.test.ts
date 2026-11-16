import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';

import {
  anthropicStripEmptySignedReasoningContent,
  ProviderHistoryCompat,
} from '../../../processors/provider-history-compat';
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

  it('keeps empty signed Anthropic thinking in the request and strips it only after the 400', async () => {
    // Claude 5.x with omitted thinking display emits a valid signed block with empty text, so the
    // block alone cannot be told apart from legacy corruption. It is stripped reactively, on the
    // "thinking blocks cannot be modified" 400, never preemptively.
    const legacyMessage = AIV5Adapter.fromModelMessage({
      id: 'msg-legacy-thinking',
      role: 'assistant',
      content: [
        {
          type: 'reasoning',
          text: '',
          providerOptions: { anthropic: { signature: 'sig-without-thinking-text' } },
        },
        { type: 'text', text: 'Hello.' },
      ],
    });

    const list = new MessageList();
    list.add({ role: 'user', content: 'Hi' }, 'input');
    list.add(legacyMessage, 'memory');
    list.add({ role: 'user', content: 'Continue.' }, 'input');

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
    expect(getAssistantReasoningParts(result?.prompt ?? prompt)).toEqual([
      expect.objectContaining({
        text: '',
        providerOptions: { anthropic: { signature: 'sig-without-thinking-text' } },
      }),
    ]);

    const mutated = anthropicStripEmptySignedReasoningContent.fix!(list.get.all.db());
    expect(mutated).toBe(true);
    expect(getAssistantReasoningParts(list.get.all.aiV5.prompt())).toHaveLength(0);
  });

  it('keeps the Anthropic signature and drops the Kimi one for an Anthropic target', async () => {
    const kimiDbMessage = AIV5Adapter.fromModelMessage({
      id: 'msg-kimi-thinking',
      role: 'assistant',
      content: [
        { type: 'reasoning', text: 'Kimi thinking.', providerOptions: { anthropic: { signature: 'sig-kimi' } } },
        { type: 'text', text: 'Kimi answer.' },
      ],
    });
    kimiDbMessage.content.metadata = { provider: 'kimi-for-coding', modelId: 'k3' };

    const anthropicDbMessage = AIV5Adapter.fromModelMessage({
      id: 'msg-anthropic-thinking-later',
      role: 'assistant',
      content: [
        {
          type: 'reasoning',
          text: 'Claude thinking.',
          providerOptions: { anthropic: { signature: 'sig-anthropic' } },
        },
        { type: 'text', text: 'Claude answer.' },
      ],
    });
    anthropicDbMessage.content.metadata = { provider: 'anthropic.messages', modelId: 'claude-sonnet-4-6' };

    const list = new MessageList();
    list.add({ role: 'user', content: 'Think briefly.' }, 'input');
    list.add(kimiDbMessage, 'memory');
    list.add({ role: 'user', content: 'Again.' }, 'input');
    list.add(anthropicDbMessage, 'memory');
    list.add({ role: 'user', content: 'Continue.' }, 'input');

    const prompt = list.get.all.aiV5.prompt();
    const result = await new ProviderHistoryCompat().processLLMRequest({
      prompt,
      model: { provider: 'anthropic.messages' },
      messageList: list,
      stepNumber: 0,
      steps: [],
      state: {},
      retryCount: 0,
      abort: (() => {
        throw new Error('abort');
      }) as any,
    });

    const signatures = (result?.prompt ?? prompt).flatMap(message =>
      Array.isArray(message.content)
        ? message.content
            .filter(part => part.type === 'reasoning')
            .map(
              part =>
                (part as { providerOptions?: { anthropic?: { signature?: string } } }).providerOptions?.anthropic
                  ?.signature,
            )
        : [],
    );

    expect(signatures).toEqual(['sig-anthropic']);
  });

  it('does not change Gemini provider metadata on non-Anthropic replay', async () => {
    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'text', text: 'Draw a cat' }] },
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
    expect((prompt[1]!.content as any[])[0].providerOptions.google.thoughtSignature).toBe('gemini-sig');
  });
});
