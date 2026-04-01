import { describe, it, expect } from 'vitest';
import { createStreamFromGenerateResult } from './generate-to-stream';

async function collectStream(stream: ReadableStream): Promise<unknown[]> {
  const reader = stream.getReader();
  const chunks: unknown[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

describe('createStreamFromGenerateResult', () => {
  it('should forward providerMetadata on tool-call stream events', async () => {
    const providerMetadata = {
      google: { thoughtSignature: 'sig_abc123' },
    };

    const result = {
      warnings: [],
      response: { id: 'resp_1', modelId: 'gemini-2.5-flash', timestamp: new Date() },
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'myTool',
          input: '{"arg":"value"}',
          providerMetadata,
        },
      ],
      finishReason: 'tool-calls',
      usage: { promptTokens: 10, completionTokens: 5 },
    };

    const chunks = await collectStream(createStreamFromGenerateResult(result));

    const toolInputStart = chunks.find((c: any) => c.type === 'tool-input-start') as any;
    expect(toolInputStart).toBeDefined();
    expect(toolInputStart.providerMetadata).toEqual(providerMetadata);

    const toolInputDelta = chunks.find((c: any) => c.type === 'tool-input-delta') as any;
    expect(toolInputDelta).toBeDefined();
    expect(toolInputDelta.providerMetadata).toEqual(providerMetadata);

    const toolInputEnd = chunks.find((c: any) => c.type === 'tool-input-end') as any;
    expect(toolInputEnd).toBeDefined();
    expect(toolInputEnd.providerMetadata).toEqual(providerMetadata);

    const toolCall = chunks.find((c: any) => c.type === 'tool-call') as any;
    expect(toolCall).toBeDefined();
    expect(toolCall.providerMetadata).toEqual(providerMetadata);
  });

  it('should handle tool-call without providerMetadata', async () => {
    const result = {
      warnings: [],
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call_2',
          toolName: 'otherTool',
          input: '{}',
        },
      ],
      finishReason: 'tool-calls',
      usage: { promptTokens: 5, completionTokens: 3 },
    };

    const chunks = await collectStream(createStreamFromGenerateResult(result));

    const toolInputStart = chunks.find((c: any) => c.type === 'tool-input-start') as any;
    expect(toolInputStart).toBeDefined();
    expect(toolInputStart.providerMetadata).toBeUndefined();

    const toolCall = chunks.find((c: any) => c.type === 'tool-call') as any;
    expect(toolCall).toBeDefined();
    expect(toolCall.providerMetadata).toBeUndefined();
  });
});
