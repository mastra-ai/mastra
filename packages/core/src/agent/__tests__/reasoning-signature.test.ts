/**
 * Reasoning Signature Preservation Tests
 *
 * Tests for GitHub issue #14559:
 * Harness drops thinking block signatures from thread history, causing API errors on replay
 *
 * When a model returns a reasoning-signature chunk, the signature must be captured and
 * stored in the message's reasoning details so it can be preserved in thread history
 * and replayed correctly.
 *
 * @see https://github.com/mastra-ai/mastra/issues/14559
 */

import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { MockLanguageModelV2, convertArrayToReadableStream } from './mock-model';

describe('reasoning-signature', () => {
  /**
   * Creates a mock model that produces reasoning with a signature chunk
   */
  function createReasoningWithSignatureModel(reasoningText: string, responseText: string, signature: string) {
    return new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: 'reasoning' as const,
            text: reasoningText,
            signature,
          },
          {
            type: 'text' as const,
            text: responseText,
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
            modelId: 'mock-signature-model',
            timestamp: new Date(0),
          },
          {
            type: 'reasoning-start',
            id: 'reasoning-1',
          },
          {
            type: 'reasoning-delta',
            id: 'reasoning-1',
            delta: reasoningText,
          },
          {
            type: 'reasoning-signature',
            id: 'reasoning-1',
            signature,
          } as any,
          {
            type: 'reasoning-end',
            id: 'reasoning-1',
          },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: responseText },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ] as any),
      }),
    });
  }

  it('should capture reasoning-signature chunk and include in message details', async () => {
    const agent = new Agent({
      id: 'signature-test',
      name: 'Signature Test Agent',
      instructions: 'You are a helpful assistant.',
      model: createReasoningWithSignatureModel(
        'Let me think about this...',
        'The answer is 42.',
        'sig-anthropic-abc123',
      ),
    });

    const response = await agent.stream('What is the meaning of life?');

    // Consume the stream
    await response.consumeStream();

    // Collect all chunks
    const chunks: any[] = [];
    for await (const chunk of response.fullStream) {
      chunks.push(chunk);
    }

    // Verify we received the reasoning-signature chunk
    const signatureChunk = chunks.find(c => c.type === 'reasoning-signature');
    expect(signatureChunk).toBeDefined();
    expect(signatureChunk?.payload?.signature).toBe('sig-anthropic-abc123');

    // Verify the final message has the signature in reasoning details
    const dbMessages = response.messageList.get.all.db();
    const assistantMessage = dbMessages.find(m => m.role === 'assistant');
    expect(assistantMessage).toBeDefined();

    // The reasoning part should have details with signature
    const reasoningPart = assistantMessage?.content.parts?.find((p: any) => p.type === 'reasoning');
    expect(reasoningPart).toBeDefined();

    // The signature should be in the details array
    const reasoningPartAny = reasoningPart as any;
    const textDetail = reasoningPartAny?.details?.find((d: any) => d.type === 'text');
    expect(textDetail).toBeDefined();
    expect(textDetail?.signature).toBe('sig-anthropic-abc123');
  });

  it('should handle multiple reasoning-signature chunks in sequence', async () => {
    const agent = new Agent({
      id: 'multi-signature-test',
      name: 'Multi Signature Test Agent',
      instructions: 'You are a helpful assistant.',
      model: createReasoningWithSignatureModel('Thinking step 1... then step 2...', 'Done.', 'sig-multi-step-xyz'),
    });

    const response = await agent.stream('Multi-step reasoning test');

    // Consume the stream
    await response.consumeStream();

    // Collect all chunks
    const chunks: any[] = [];
    for await (const chunk of response.fullStream) {
      chunks.push(chunk);
    }

    // Verify we received the reasoning-signature chunk
    const signatureChunk = chunks.find(c => c.type === 'reasoning-signature');
    expect(signatureChunk).toBeDefined();
    expect(signatureChunk?.payload?.signature).toBe('sig-multi-step-xyz');
  });

  it('should work without reasoning-signature chunk (backwards compatible)', async () => {
    // Model that doesn't produce signature chunks
    const modelWithoutSignature = new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: 'reasoning' as const,
            text: 'Thinking...',
          },
          {
            type: 'text' as const,
            text: 'Response without signature.',
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
            modelId: 'mock-no-sig-model',
            timestamp: new Date(0),
          },
          {
            type: 'reasoning-start',
            id: 'reasoning-1',
          },
          {
            type: 'reasoning-delta',
            id: 'reasoning-1',
            delta: 'Thinking...',
          },
          {
            type: 'reasoning-end',
            id: 'reasoning-1',
          },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Response without signature.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });

    const agent = new Agent({
      id: 'no-signature-test',
      name: 'No Signature Test Agent',
      instructions: 'You are a helpful assistant.',
      model: modelWithoutSignature,
    });

    const response = await agent.stream('Test without signature');

    // Consume the stream
    await response.consumeStream();

    // Collect all chunks
    const chunks: any[] = [];
    for await (const chunk of response.fullStream) {
      chunks.push(chunk);
    }

    // Verify we did NOT receive a reasoning-signature chunk
    const signatureChunk = chunks.find(c => c.type === 'reasoning-signature');
    expect(signatureChunk).toBeUndefined();

    // Verify the message still works correctly
    const dbMessages = response.messageList.get.all.db();
    const assistantMessage = dbMessages.find(m => m.role === 'assistant');
    expect(assistantMessage).toBeDefined();

    const reasoningPart = assistantMessage?.content.parts?.find((p: any) => p.type === 'reasoning');
    expect(reasoningPart).toBeDefined();
    const reasoningPartAny2 = reasoningPart as any;
    expect(reasoningPartAny2?.details?.[0]?.text).toBe('Thinking...');
    // Signature should be undefined when not provided
    expect(reasoningPartAny2?.details?.[0]?.signature).toBeUndefined();
  });
});
