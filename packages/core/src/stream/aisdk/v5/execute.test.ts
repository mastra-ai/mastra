import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { execute } from './execute';
import { testUsage } from './test-utils';

const inputMessages = [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Summarize the plan.' }] }];
const schema = z.object({ suggestions: z.array(z.string()).min(1).max(3) });

async function readStream(stream: ReadableStream) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

describe('execute structured output prompt handling', () => {
  it('does not inject processor schema instructions into the main prompt when useAgent is enabled', async () => {
    let capturedPrompt: unknown;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }: any) => {
        capturedPrompt = prompt;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Main agent summary.' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsage, providerMetadata: undefined },
          ]),
          request: { body: '' },
          response: { headers: {} },
          warnings: [] as any[],
        };
      },
    });

    const stream = execute({
      runId: 'test-run-id',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      structuredOutput: {
        schema,
        model: model as any,
        useAgent: true,
      },
    });

    await readStream(stream);

    expect(capturedPrompt).toEqual(inputMessages);
    expect(JSON.stringify(capturedPrompt)).not.toContain(
      'Your response will be processed by another agent to extract structured data',
    );
  });

  it('injects processor schema instructions into the main prompt when useAgent is disabled', async () => {
    let capturedPrompt: unknown;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }: any) => {
        capturedPrompt = prompt;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Main agent summary.' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsage, providerMetadata: undefined },
          ]),
          request: { body: '' },
          response: { headers: {} },
          warnings: [] as any[],
        };
      },
    });

    const stream = execute({
      runId: 'test-run-id',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      structuredOutput: {
        schema,
        model: model as any,
      },
    });

    await readStream(stream);

    expect(capturedPrompt).not.toEqual(inputMessages);
    const promptJson = JSON.stringify(capturedPrompt);
    expect(promptJson).toContain('Your response will be processed by another agent to extract structured data');
    expect(promptJson).toContain('suggestions');
  });
});
