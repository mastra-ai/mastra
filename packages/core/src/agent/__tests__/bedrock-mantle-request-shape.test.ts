import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { MockLanguageModelV2, convertArrayToReadableStream } from './mock-model';

function createCapturingModel(provider: string, modelId: string, prompts: LanguageModelV2Prompt[]) {
  return new MockLanguageModelV2({
    provider,
    modelId,
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't1' },
          { type: 'text-delta', id: 't1', delta: 'ok' },
          { type: 'text-end', id: 't1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
}

const input = [
  {
    role: 'user' as const,
    content: [
      { type: 'text' as const, text: 'context' },
      { type: 'text' as const, text: 'question' },
    ],
  },
];

describe('Bedrock Mantle GPT-OSS request shape (#19228)', () => {
  it('sends user content as a single text part for bedrock-mantle.chat + openai.gpt-oss-*', async () => {
    const prompts: LanguageModelV2Prompt[] = [];
    const agent = new Agent({
      id: 'mantle',
      name: 'mantle',
      instructions: 'be helpful',
      model: createCapturingModel('bedrock-mantle.chat', 'openai.gpt-oss-20b', prompts),
    });

    const result = await agent.stream(input);
    await result.consumeStream();

    const user = prompts[0]!.find(m => m.role === 'user')!;
    expect(user.content).toEqual([{ type: 'text', text: 'context\n\nquestion' }]);
  });

  it('leaves other providers unchanged', async () => {
    const prompts: LanguageModelV2Prompt[] = [];
    const agent = new Agent({
      id: 'other',
      name: 'other',
      instructions: 'be helpful',
      model: createCapturingModel('openai.chat', 'gpt-4o', prompts),
    });

    const result = await agent.stream(input);
    await result.consumeStream();

    const user = prompts[0]!.find(m => m.role === 'user')!;
    expect(user.content).toHaveLength(2);
  });
});
