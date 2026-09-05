import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { ProviderHistoryCompat } from '../../processors/provider-history-compat';
import { Agent } from '../agent';

describe('provider boundary compatibility', () => {
  it('strips reasoning at the ordinary Agent provider boundary and preserves history', async () => {
    let outboundPrompt: any;
    const model = new MockLanguageModelV2({
      provider: 'bedrock-mantle.chat',
      modelId: 'openai.gpt-oss-20b',
      doGenerate: async ({ prompt }) => {
        outboundPrompt = prompt;
        const hasReasoning = prompt.some(
          message =>
            message.role === 'assistant' &&
            Array.isArray(message.content) &&
            message.content.some(part => part.type === 'reasoning'),
        );

        if (hasReasoning) throw new Error("Invalid 'messages': Invalid 'content'");

        return {
          content: [{ type: 'text', text: 'ok' }],
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'provider-boundary-reproduction',
      name: 'provider-boundary-reproduction',
      instructions: 'Answer briefly.',
      model,
    });

    const history = [
      { role: 'user' as const, content: 'Explain this.' },
      {
        role: 'assistant' as const,
        content: [
          { type: 'reasoning' as const, text: 'private reasoning' },
          { type: 'text' as const, text: 'A concise answer.' },
        ],
      },
      { role: 'user' as const, content: 'Continue.' },
    ];
    const originalHistory = structuredClone(history);

    const result = await agent.generate(history);

    expect(result.text).toBe('ok');
    expect(outboundPrompt.flatMap((message: any) => (Array.isArray(message.content) ? message.content : []))).not.toContainEqual(
      expect.objectContaining({ type: 'reasoning' }),
    );
    expect(history).toEqual(originalHistory);
  });

  it('keeps reasoning in the Agent message list while filtering the stream prompt', async () => {
    let outboundPrompt: any;
    const model = new MockLanguageModelV2({
      provider: 'bedrock-mantle.chat',
      modelId: 'openai.gpt-oss-20b',
      doStream: async ({ prompt }) => {
        outboundPrompt = prompt;
        const hasReasoning = prompt.some(
          message =>
            message.role === 'assistant' &&
            Array.isArray(message.content) &&
            message.content.some(part => part.type === 'reasoning'),
        );

        if (hasReasoning) throw new Error("Invalid 'messages': Invalid 'content'");

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          stream: convertArrayToReadableStream([
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'ok' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'provider-boundary-history',
      name: 'provider-boundary-history',
      instructions: 'Answer briefly.',
      model,
    });
    const history = [
      { role: 'user' as const, content: 'Explain this.' },
      {
        role: 'assistant' as const,
        content: [
          { type: 'reasoning' as const, text: 'durable-reasoning-sentinel' },
          { type: 'text' as const, text: 'A concise answer.' },
        ],
      },
      { role: 'user' as const, content: 'Continue.' },
    ];
    const originalHistory = structuredClone(history);

    const response = await agent.stream(history);
    await response.consumeStream();

    expect(outboundPrompt.flatMap((message: any) => (Array.isArray(message.content) ? message.content : []))).not.toContainEqual(
      expect.objectContaining({ type: 'reasoning' }),
    );
    expect(response.messageList.get.all.db().flatMap(message => message.content.parts)).toContainEqual(
      expect.objectContaining({ type: 'reasoning', reasoning: 'durable-reasoning-sentinel' }),
    );
    expect(history).toEqual(originalHistory);
  });

  it('installs the narrow processor once and lets explicit full compat win', async () => {
    const model = new MockLanguageModelV2({ provider: 'bedrock-mantle.chat', modelId: 'openai.gpt-oss-20b' });
    const automatic = new Agent({ id: 'automatic', name: 'automatic', instructions: 'test', model });
    expect((await automatic.__listLLMRequestProcessors()).map(processor => processor.id)).toContain(
      'provider-boundary-compat',
    );

    const explicit = new Agent({
      id: 'explicit',
      name: 'explicit',
      instructions: 'test',
      model,
      inputProcessors: [new ProviderHistoryCompat()],
    });
    const ids = (await explicit.__listLLMRequestProcessors()).map(processor => processor.id);
    expect(ids).toContain('provider-history-compat');
    expect(ids).not.toContain('provider-boundary-compat');
  });
});
