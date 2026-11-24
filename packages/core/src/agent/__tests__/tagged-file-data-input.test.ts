import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';

const BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function createRecordingModel() {
  const prompts: any[] = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'ok' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
  return { model, prompts };
}

function fileDataBytes(prompt: any[]): Buffer {
  const filePart = prompt
    .filter(m => m.role === 'user')
    .flatMap(m => m.content)
    .find((p: any) => p.type === 'file');
  expect(filePart).toBeDefined();
  const data = filePart.data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data instanceof URL) return Buffer.from(data.toString().split(',')[1] ?? '', 'base64');
  const str = String(data);
  return Buffer.from(str.startsWith('data:') ? (str.split(',')[1] ?? '') : str, 'base64');
}

describe('Agent with AI SDK v7 tagged FileData in ModelMessage input', () => {
  it.each([
    ['{ type: "data" } with base64', { type: 'data', data: BASE64 }],
    ['{ type: "url" } with a data URL', { type: 'url', url: `data:image/png;base64,${BASE64}` }],
  ])('sends the file bytes to the model for %s', async (_label, data) => {
    const { model, prompts } = createRecordingModel();
    const agent = new Agent({ id: 'tagged-file-agent', name: 'tagged-file-agent', instructions: 'test', model });

    const result = await agent.stream([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Describe this image' }, { type: 'file', mediaType: 'image/png', data } as any],
      },
    ]);
    await result.consumeStream();

    expect(prompts).toHaveLength(1);
    const bytes = fileDataBytes(prompts[0]);
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.toString('base64')).toBe(BASE64);
  });
});
