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

  // The AI SDK content union is wider than the parts this converter expands
  // explicitly. 'reasoning-file' and 'custom' are provider-v4 content types and
  // 'tool-approval-request' exists in provider-v3 and v4. All three are also
  // valid stream parts with an identical shape, so doStream() forwards them
  // untouched; the generate path must not be lossier than the stream path.
  describe('content parts that map straight to a stream part', () => {
    it('should forward a reasoning-file part instead of dropping it', async () => {
      const result = {
        warnings: [],
        content: [{ type: 'reasoning-file', mediaType: 'image/png', data: 'aGVsbG8=' }],
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1 },
      };

      const chunks = await collectStream(createStreamFromGenerateResult(result));

      expect(chunks).toContainEqual({
        type: 'reasoning-file',
        mediaType: 'image/png',
        data: 'aGVsbG8=',
      });
    });

    it('should forward a custom part with its provider kind and metadata', async () => {
      const providerMetadata = { openai: { itemId: 'item_1' } };
      const result = {
        warnings: [],
        content: [{ type: 'custom', kind: 'openai.reasoning-summary', providerMetadata }],
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1 },
      };

      const chunks = await collectStream(createStreamFromGenerateResult(result));

      expect(chunks).toContainEqual({
        type: 'custom',
        kind: 'openai.reasoning-summary',
        providerMetadata,
      });
    });

    it('should forward a tool-approval-request so approvals reach consumers', async () => {
      const result = {
        warnings: [],
        content: [
          { type: 'tool-call', toolCallId: 'call_1', toolName: 'deleteFile', input: '{}' },
          { type: 'tool-approval-request', approvalId: 'approval_1', toolCallId: 'call_1' },
        ],
        finishReason: 'tool-calls',
        usage: { promptTokens: 1, completionTokens: 1 },
      };

      const chunks = await collectStream(createStreamFromGenerateResult(result));

      expect(chunks).toContainEqual({
        type: 'tool-approval-request',
        approvalId: 'approval_1',
        toolCallId: 'call_1',
      });
    });

    it('should preserve content order when forwarded parts sit between expanded ones', async () => {
      const result = {
        warnings: [],
        content: [
          { type: 'text', text: 'before' },
          { type: 'custom', kind: 'acme.marker' },
          { type: 'text', text: 'after' },
        ],
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1 },
      };

      const chunks = (await collectStream(createStreamFromGenerateResult(result))) as Array<{
        type: string;
        delta?: string;
      }>;

      const order = chunks
        .filter(c => c.type === 'text-delta' || c.type === 'custom')
        .map(c => (c.type === 'custom' ? 'custom' : c.delta));

      expect(order).toEqual(['before', 'custom', 'after']);
    });

    it('should still map handled parts rather than forwarding them verbatim', async () => {
      const result = {
        warnings: [],
        content: [{ type: 'source', sourceType: 'url', id: 'src_1', url: 'https://example.com', title: 'Example' }],
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1 },
      };

      const chunks = (await collectStream(createStreamFromGenerateResult(result))) as Array<{ type: string }>;

      // A single mapped 'source' event, not the raw content part echoed alongside it.
      expect(chunks.filter(c => c.type === 'source')).toHaveLength(1);
    });
  });
});
