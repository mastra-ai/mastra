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

  it('should forward providerMetadata on text and file stream events', async () => {
    const textProviderMetadata = {
      google: { thoughtSignature: 'sig_text' },
    };
    const fileProviderMetadata = {
      openai: { fileId: 'file_123' },
    };
    const result = {
      warnings: [],
      content: [
        {
          type: 'text',
          text: 'Hello',
          providerMetadata: textProviderMetadata,
        },
        {
          type: 'file',
          mediaType: 'application/pdf',
          data: 'file-data',
          providerMetadata: fileProviderMetadata,
        },
      ],
      finishReason: 'stop',
      usage: { promptTokens: 5, completionTokens: 3 },
    };

    const chunks = await collectStream(createStreamFromGenerateResult(result));

    const textStart = chunks.find((c: any) => c.type === 'text-start') as any;
    const textDelta = chunks.find((c: any) => c.type === 'text-delta') as any;
    const textEnd = chunks.find((c: any) => c.type === 'text-end') as any;
    const file = chunks.find((c: any) => c.type === 'file') as any;

    expect(textStart.providerMetadata).toEqual(textProviderMetadata);
    expect(textDelta.providerMetadata).toEqual(textProviderMetadata);
    expect(textEnd.providerMetadata).toEqual(textProviderMetadata);
    expect(file.providerMetadata).toEqual(fileProviderMetadata);
  });

  it('should handle text and file content without providerMetadata', async () => {
    const result = {
      warnings: [],
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'file', mediaType: 'application/pdf', data: 'file-data' },
      ],
      finishReason: 'stop',
      usage: { promptTokens: 5, completionTokens: 3 },
    };

    const chunks = await collectStream(createStreamFromGenerateResult(result));

    const textStart = chunks.find((c: any) => c.type === 'text-start') as any;
    const textDelta = chunks.find((c: any) => c.type === 'text-delta') as any;
    const textEnd = chunks.find((c: any) => c.type === 'text-end') as any;
    const file = chunks.find((c: any) => c.type === 'file') as any;

    expect(textStart.providerMetadata).toBeUndefined();
    expect(textDelta.providerMetadata).toBeUndefined();
    expect(textEnd.providerMetadata).toBeUndefined();
    expect(file.providerMetadata).toBeUndefined();
  });

  it('should pass through reasoning-file and custom content parts', async () => {
    const reasoningFile = {
      type: 'reasoning-file',
      mediaType: 'application/pdf',
      data: 'reasoning-file-data',
      providerMetadata: { anthropic: { some: 'meta' } },
    };
    const custom = {
      type: 'custom',
      kind: 'anthropic.container_upload',
      providerMetadata: { anthropic: { fileId: 'file_1' } },
    };

    const result = {
      warnings: [],
      content: [reasoningFile, custom],
      finishReason: 'stop',
      usage: { promptTokens: 5, completionTokens: 3 },
    };

    const chunks = await collectStream(createStreamFromGenerateResult(result));

    expect(chunks.find((c: any) => c.type === 'reasoning-file')).toEqual(reasoningFile);
    expect(chunks.find((c: any) => c.type === 'custom')).toEqual(custom);
    expect(chunks.some((c: any) => c.type === 'raw')).toBe(false);
  });

  it('should surface unknown content parts as raw stream parts instead of dropping them', async () => {
    const unknownPart = { type: 'some-future-part', value: 'do-not-drop-me' };

    const result = {
      warnings: [],
      content: [{ type: 'text', text: 'Hello' }, unknownPart],
      finishReason: 'stop',
      usage: { promptTokens: 5, completionTokens: 3 },
    };

    const chunks = await collectStream(createStreamFromGenerateResult(result));

    expect(chunks.find((c: any) => c.type === 'raw')).toEqual({ type: 'raw', rawValue: unknownPart });
    // Known types are unaffected.
    expect(chunks.find((c: any) => c.type === 'text-delta')).toBeDefined();
  });
});
