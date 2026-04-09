import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { MockLanguageModelV2, convertArrayToReadableStream } from './mock-model';

function createOpenAISummaryStreamingModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [
        {
          type: 'reasoning',
          text: 'First summary.',
          providerMetadata: { openai: { itemId: 'rs_1:0', reasoningEncryptedContent: 'enc-1' } },
        },
        {
          type: 'reasoning',
          text: 'Second summary.',
          providerMetadata: { openai: { itemId: 'rs_1:1', reasoningEncryptedContent: 'enc-1' } },
        },
        {
          type: 'text',
          text: 'Final answer.',
        },
      ],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        {
          type: 'response-metadata',
          id: 'response-1',
          modelId: 'mock-openai-summaries-model',
          timestamp: new Date(0),
        },
        {
          type: 'reasoning-start',
          id: 'rs_1:0',
          providerMetadata: { openai: { itemId: 'rs_1', reasoningEncryptedContent: 'enc-1' } },
        },
        {
          type: 'reasoning-delta',
          id: 'rs_1:0',
          delta: 'First summary.',
          providerMetadata: { openai: { itemId: 'rs_1', reasoningEncryptedContent: 'enc-1' } },
        },
        {
          type: 'reasoning-start',
          id: 'rs_1:1',
          providerMetadata: { openai: { itemId: 'rs_1', reasoningEncryptedContent: 'enc-1' } },
        },
        {
          type: 'reasoning-delta',
          id: 'rs_1:1',
          delta: 'Second summary.',
          providerMetadata: { openai: { itemId: 'rs_1', reasoningEncryptedContent: 'enc-1' } },
        },
        {
          type: 'reasoning-end',
          id: 'rs_1:0',
          providerMetadata: { openai: { itemId: 'rs_1', reasoningEncryptedContent: 'enc-1' } },
        },
        {
          type: 'reasoning-end',
          id: 'rs_1:1',
          providerMetadata: { openai: { itemId: 'rs_1', reasoningEncryptedContent: 'enc-1' } },
        },
        { type: 'text-start', id: 'msg_1' },
        { type: 'text-delta', id: 'msg_1', delta: 'Final answer.' },
        { type: 'text-end', id: 'msg_1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
    }),
  });
}

describe('OpenAI reasoning summary streaming', () => {
  it('stores each reasoning summary as a distinct reasoning part when summary ids overlap', async () => {
    const agent = new Agent({
      id: 'openai-reasoning-summaries-test',
      name: 'OpenAI Reasoning Summaries Test',
      instructions: 'You are a helpful assistant.',
      model: createOpenAISummaryStreamingModel(),
    });

    const response = await agent.stream('Explain your answer.');
    await response.consumeStream();

    const assistantMessages = response.messageList.get.all.db().filter(m => m.role === 'assistant');
    const reasoningParts = assistantMessages.flatMap(m => m.content.parts).filter(p => p.type === 'reasoning');
    const textParts = assistantMessages.flatMap(m => m.content.parts).filter(p => p.type === 'text');

    expect(reasoningParts).toHaveLength(2);
    expect(textParts).toHaveLength(1);

    const firstDetail = reasoningParts[0].details[0];
    const secondDetail = reasoningParts[1].details[0];

    expect(firstDetail.type).toBe('text');
    expect(secondDetail.type).toBe('text');

    if (firstDetail.type === 'text' && secondDetail.type === 'text') {
      expect(firstDetail.text).toBe('First summary.');
      expect(secondDetail.text).toBe('Second summary.');
    }
  });
});
