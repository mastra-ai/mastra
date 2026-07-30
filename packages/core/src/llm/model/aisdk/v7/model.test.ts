import type { LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4StreamPart } from '@ai-sdk/provider-v7';
import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '../../../../agent/message-list';
import { MastraError } from '../../../../error';
import { convertFullStreamChunkToMastra } from '../../../../stream/aisdk/v5/transform';
import { AISDKV7LanguageModel } from './model';

async function collectStream(stream: ReadableStream): Promise<any[]> {
  const chunks: any[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

function createMockV4Model() {
  return {
    specificationVersion: 'v4',
    provider: 'openai',
    modelId: 'test-v4-model',
    supportedUrls: {},
    doGenerate: vi.fn(async () => ({
      content: [],
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      warnings: [],
    })),
    doStream: vi.fn(async () => ({
      stream: new ReadableStream(),
    })),
  } as unknown as LanguageModelV4;
}

describe('AISDKV7LanguageModel', () => {
  describe('serializeForSpan', () => {
    it('returns only identity fields', () => {
      const wrapped = new AISDKV7LanguageModel(createMockV4Model());

      expect(wrapped.serializeForSpan()).toEqual({
        specificationVersion: 'v4',
        modelId: 'test-v4-model',
        provider: 'openai',
      });
    });

    it('does not expose the wrapped provider SDK client', () => {
      const wrapped = new AISDKV7LanguageModel(createMockV4Model());

      const serialized = JSON.stringify(wrapped.serializeForSpan());

      expect(serialized).not.toContain('supportedUrls');
      expect(serialized).not.toContain('doGenerate');
      expect(serialized).not.toContain('doStream');
    });
  });

  describe('tool remapping', () => {
    it('remaps provider-defined tools to provider for V4 in doStream', async () => {
      const model = createMockV4Model();
      const wrapped = new AISDKV7LanguageModel(model);

      const options = {
        prompt: [],
        tools: [{ type: 'provider-defined', id: 'openai.web_search', name: 'web_search', args: {} }],
      } as unknown as LanguageModelV4CallOptions;

      await wrapped.doStream(options);

      const passed = (model.doStream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(passed.tools[0].type).toBe('provider');
    });

    it('leaves function tools untouched', async () => {
      const model = createMockV4Model();
      const wrapped = new AISDKV7LanguageModel(model);

      const options = {
        prompt: [],
        tools: [{ type: 'function', name: 'getWeather', inputSchema: {} }],
      } as unknown as LanguageModelV4CallOptions;

      await wrapped.doStream(options);

      const passed = (model.doStream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(passed.tools[0].type).toBe('function');
    });
  });

  describe('file part remapping', () => {
    it('normalizes file data from the agent prompt before streaming to a V4 provider', async () => {
      const model = createMockV4Model();
      const wrapped = new AISDKV7LanguageModel(model);
      const imageData = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
      const messageList = new MessageList();

      messageList.add(
        [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this image?' },
              {
                type: 'file',
                data: `data:image/webp;base64,${imageData}`,
                mimeType: 'image/webp',
              },
            ],
          },
        ],
        'input',
      );

      const prompt = await messageList.get.all.aiV6.llmPrompt();
      const legacyFilePart =
        prompt[0]?.role === 'user' ? prompt[0].content.find(part => part.type === 'file') : undefined;

      // This is the flat V2/V3 data shape produced by the Agent's prompt path.
      expect(legacyFilePart).toMatchObject({
        type: 'file',
        data: imageData,
        mediaType: 'image/webp',
      });

      await wrapped.doStream({ prompt } as unknown as LanguageModelV4CallOptions);

      const passed = (model.doStream as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      const v4FilePart = passed.prompt[0].content.find((part: { type: string }) => part.type === 'file');

      expect(v4FilePart).toMatchObject({
        type: 'file',
        data: { type: 'data', data: imageData },
        mediaType: 'image/webp',
      });
    });

    it('normalizes all legacy file data forms for doGenerate and preserves tagged data', async () => {
      const model = createMockV4Model();
      const wrapped = new AISDKV7LanguageModel(model);
      const remoteUrl = new URL('https://example.com/image.jpeg');
      const binaryData = new Uint8Array([1, 2, 3]);
      const taggedData = { type: 'reference' as const, reference: { openai: 'file-123' } };

      await wrapped.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'file', data: 'data:image/gif;base64,R0lGODlh', mediaType: 'application/octet-stream' },
              { type: 'file', data: 'aGVsbG8=', mediaType: 'text/plain' },
              { type: 'file', data: remoteUrl, mediaType: 'image/jpeg' },
              { type: 'file', data: binaryData, mediaType: 'application/octet-stream' },
              { type: 'file', data: taggedData, mediaType: 'application/pdf' },
            ],
          },
          {
            role: 'assistant',
            content: [{ type: 'file', data: 'YXNzaXN0YW50', mediaType: 'text/plain' }],
          },
        ],
      } as unknown as LanguageModelV4CallOptions);

      const passed = (model.doGenerate as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      const fileParts = passed.prompt[0].content.filter((part: { type: string }) => part.type === 'file');
      const assistantFilePart = passed.prompt[1].content.find((part: { type: string }) => part.type === 'file');

      expect(fileParts).toEqual([
        {
          type: 'file',
          data: { type: 'data', data: 'R0lGODlh' },
          mediaType: 'image/gif',
        },
        {
          type: 'file',
          data: { type: 'data', data: 'aGVsbG8=' },
          mediaType: 'text/plain',
        },
        {
          type: 'file',
          data: { type: 'url', url: remoteUrl },
          mediaType: 'image/jpeg',
        },
        {
          type: 'file',
          data: { type: 'data', data: binaryData },
          mediaType: 'application/octet-stream',
        },
        {
          type: 'file',
          data: taggedData,
          mediaType: 'application/pdf',
        },
      ]);
      expect(fileParts[4].data).toBe(taggedData);
      expect(assistantFilePart).toMatchObject({
        type: 'file',
        data: { type: 'data', data: 'YXNzaXN0YW50' },
        mediaType: 'text/plain',
      });
    });

    it('throws a MastraError client-side for malformed data URIs instead of sending them to the provider', async () => {
      const model = createMockV4Model();
      const wrapped = new AISDKV7LanguageModel(model);

      const options = {
        prompt: [
          {
            role: 'user',
            content: [{ type: 'file', data: 'data:image/png', mediaType: 'image/png' }],
          },
        ],
      } as unknown as LanguageModelV4CallOptions;

      await expect(wrapped.doGenerate(options)).rejects.toSatisfy(
        error => error instanceof MastraError && error.id === 'INVALID_DATA_URL_FORMAT',
      );
      expect(model.doGenerate).not.toHaveBeenCalled();
    });
  });

  describe('response file untagging', () => {
    it('untags generated file data from doStream so the shared pipeline receives the flat shape', async () => {
      const model = createMockV4Model();
      const generatedBytes = new Uint8Array([137, 80, 78, 71]);
      (model.doStream as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        stream: new ReadableStream<LanguageModelV4StreamPart>({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'file',
              mediaType: 'image/png',
              data: { type: 'data', data: generatedBytes },
            });
            controller.enqueue({
              type: 'file',
              mediaType: 'image/jpeg',
              data: { type: 'url', url: new URL('https://example.com/generated.jpeg') },
            });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: {},
            } as unknown as LanguageModelV4StreamPart);
            controller.close();
          },
        }),
      });
      const wrapped = new AISDKV7LanguageModel(model);

      const result = await wrapped.doStream({ prompt: [] } as unknown as LanguageModelV4CallOptions);
      const chunks = await collectStream(result.stream);
      const fileChunks = chunks.filter(chunk => chunk.type === 'file');

      expect(fileChunks).toEqual([
        { type: 'file', mediaType: 'image/png', data: generatedBytes },
        { type: 'file', mediaType: 'image/jpeg', data: 'https://example.com/generated.jpeg' },
      ]);
      expect(chunks[0]).toEqual({ type: 'stream-start', warnings: [] });
    });

    it('untags generated file data from doGenerate in both content and the derived stream', async () => {
      const model = createMockV4Model();
      const generatedBase64 = 'iVBORw0KGgo=';
      (model.doGenerate as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: [
          { type: 'text', text: 'Here is your image.' },
          { type: 'file', mediaType: 'image/png', data: { type: 'data', data: generatedBase64 } },
        ],
        finishReason: 'stop',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        warnings: [],
      });
      const wrapped = new AISDKV7LanguageModel(model);

      const result = await wrapped.doGenerate({ prompt: [] } as unknown as LanguageModelV4CallOptions);

      expect(result.content).toContainEqual({
        type: 'file',
        mediaType: 'image/png',
        data: generatedBase64,
      });

      const chunks = await collectStream(result.stream);
      expect(chunks).toContainEqual({
        type: 'file',
        mediaType: 'image/png',
        data: generatedBase64,
      });
    });

    it('untags reasoning-file data in both doStream parts and doGenerate content', async () => {
      const model = createMockV4Model();
      const reasoningBytes = new Uint8Array([1, 2, 3]);
      (model.doStream as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        stream: new ReadableStream<LanguageModelV4StreamPart>({
          start(controller) {
            controller.enqueue({
              type: 'reasoning-file',
              mediaType: 'image/png',
              data: { type: 'data', data: reasoningBytes },
            } as unknown as LanguageModelV4StreamPart);
            controller.close();
          },
        }),
      });
      (model.doGenerate as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: [{ type: 'reasoning-file', mediaType: 'image/png', data: { type: 'data', data: 'aGVsbG8=' } }],
        finishReason: 'stop',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        warnings: [],
      });
      const wrapped = new AISDKV7LanguageModel(model);

      const streamResult = await wrapped.doStream({ prompt: [] } as unknown as LanguageModelV4CallOptions);
      const chunks = await collectStream(streamResult.stream);
      expect(chunks).toEqual([{ type: 'reasoning-file', mediaType: 'image/png', data: reasoningBytes }]);

      const generateResult = await wrapped.doGenerate({ prompt: [] } as unknown as LanguageModelV4CallOptions);
      expect(generateResult.content).toContainEqual({
        type: 'reasoning-file',
        mediaType: 'image/png',
        data: 'aGVsbG8=',
      });
    });

    it('produces flat data the shared chunk transform maps to a valid FileChunk payload', async () => {
      const model = createMockV4Model();
      const generatedBase64 = 'iVBORw0KGgo=';
      (model.doStream as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        stream: new ReadableStream<LanguageModelV4StreamPart>({
          start(controller) {
            controller.enqueue({
              type: 'file',
              mediaType: 'image/png',
              data: { type: 'data', data: generatedBase64 },
            });
            controller.enqueue({
              type: 'file',
              mediaType: 'image/jpeg',
              data: { type: 'url', url: new URL('https://example.com/generated.jpeg') },
            });
            controller.close();
          },
        }),
      });
      const wrapped = new AISDKV7LanguageModel(model);

      const result = await wrapped.doStream({ prompt: [] } as unknown as LanguageModelV4CallOptions);
      const parts = await collectStream(result.stream);
      const fileChunks = parts.map(part => convertFullStreamChunkToMastra(part, { runId: 'test-run' }));

      // base64-backed file: data flows through flat and is labeled as base64.
      expect(fileChunks[0]).toMatchObject({
        type: 'file',
        payload: { data: generatedBase64, base64: generatedBase64, mimeType: 'image/png' },
      });
      // URL-backed file: the URL string is preserved but never mislabeled as base64.
      expect(fileChunks[1]).toMatchObject({
        type: 'file',
        payload: { data: 'https://example.com/generated.jpeg', base64: undefined, mimeType: 'image/jpeg' },
      });
    });

    it('passes unsupported tagged variants (reference/text) through unchanged instead of untagging to undefined', async () => {
      const model = createMockV4Model();
      const referenceData = { type: 'reference', reference: { openai: 'file-123' } };
      (model.doGenerate as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        content: [{ type: 'file', mediaType: 'image/png', data: referenceData }],
        finishReason: 'stop',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        warnings: [],
      });
      const wrapped = new AISDKV7LanguageModel(model);

      const result = await wrapped.doGenerate({ prompt: [] } as unknown as LanguageModelV4CallOptions);

      expect(result.content).toContainEqual({
        type: 'file',
        mediaType: 'image/png',
        data: referenceData,
      });
    });

    it('passes flat response file data through unchanged', async () => {
      const model = createMockV4Model();
      const content = [{ type: 'file', mediaType: 'image/png', data: 'iVBORw0KGgo=' }];
      (model.doGenerate as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        content,
        finishReason: 'stop',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        warnings: [],
      });
      const wrapped = new AISDKV7LanguageModel(model);

      const result = await wrapped.doGenerate({ prompt: [] } as unknown as LanguageModelV4CallOptions);

      expect(result.content).toBe(content);
    });
  });
});
