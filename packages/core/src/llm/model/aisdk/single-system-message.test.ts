import { createAnthropic } from '@ai-sdk/anthropic-v5';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible-v5';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';
import { toSingleSystemMessage } from './single-system-message';
import { AISDKV5LanguageModel } from './v5/model';

// https://github.com/mastra-ai/mastra/issues/25435
const prompt: LanguageModelV2Prompt = [
  { role: 'system', content: 'You are helpful.' },
  { role: 'system', content: 'Connected agents: none.' },
  { role: 'user', content: [{ type: 'text', text: 'hi' }] },
];

async function captureBody(model: ConstructorParameters<typeof AISDKV5LanguageModel>[0]) {
  await new AISDKV5LanguageModel(model).doGenerate({ prompt }).catch(() => {});
  return captured.shift();
}

const captured: any[] = [];
const fetch = (async (_url: string, init: RequestInit) => {
  captured.push(JSON.parse(init.body as string));
  return new Response('{}', { status: 500 });
}) as typeof globalThis.fetch;

describe('single leading system message for Chat Completions models', () => {
  it('sends one system message to an OpenAI-compatible endpoint', async () => {
    const model = createOpenAICompatible({ name: 'my-vllm', baseURL: 'http://vllm.test/v1', fetch }).chatModel('qwen');
    const body = await captureBody(model);
    expect(body.messages).toEqual([
      { role: 'system', content: 'You are helpful.\n\nConnected agents: none.' },
      { role: 'user', content: 'hi' },
    ]);
  });

  it('leaves native APIs with a system field unchanged', async () => {
    const model = createAnthropic({ apiKey: 'k', baseURL: 'http://anthropic.test/v1', fetch })('claude');
    const body = await captureBody(model);
    expect(body.system).toEqual([
      { type: 'text', text: 'You are helpful.' },
      { type: 'text', text: 'Connected agents: none.' },
    ]);
  });

  it.each(['anthropic', 'anthropic.messages', 'google.generative-ai', 'bedrock', 'openai.responses'])(
    'does not touch %s prompts',
    provider => {
      expect(toSingleSystemMessage(provider, prompt)).toBe(prompt);
    },
  );

  it('keeps the last providerOptions so the cache breakpoint covers the merged prefix', () => {
    const cache = { openrouter: { cacheControl: { type: 'ephemeral' } } };
    const out = toSingleSystemMessage('openrouter.chat', [
      { role: 'system', content: 'a', providerOptions: { x: { y: 1 } } },
      { role: 'system', content: 'b', providerOptions: cache },
      { role: 'system', content: 'c' },
      { role: 'user', content: [{ type: 'text', text: 'u' }] },
    ] as LanguageModelV2Prompt);
    expect(out[0]).toEqual({ role: 'system', content: 'a\n\nb\n\nc', providerOptions: cache });
  });

  it('turns mid-conversation system messages into user reminders', () => {
    const out = toSingleSystemMessage('my-vllm.chat', [
      { role: 'system', content: 'a' },
      { role: 'user', content: [{ type: 'text', text: 'u' }] },
      { role: 'system', content: 'late' },
    ] as LanguageModelV2Prompt);
    expect(out).toEqual([
      { role: 'system', content: 'a' },
      { role: 'user', content: [{ type: 'text', text: 'u' }] },
      { role: 'user', content: [{ type: 'text', text: '<system-reminder>late</system-reminder>' }] },
    ]);
  });

  it('returns the prompt as-is when it already has one leading system message', () => {
    expect(toSingleSystemMessage('my-vllm.chat', prompt.slice(1))).toEqual(prompt.slice(1));
  });
});
