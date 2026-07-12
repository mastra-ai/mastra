import type { LanguageModelV4, LanguageModelV4CallOptions } from '@ai-sdk/provider-v7';
import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '../../../../agent/message-list';
import { AISDKV7LanguageModel } from './model';

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
  });
});
