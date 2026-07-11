import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { coreFeatures } from '../../../features';
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
  it('advertises inline JSON prompt injection support', () => {
    expect(coreFeatures.has('json-prompt-injection:inline')).toBe(true);
  });

  it('injects direct structured output schema into the leading system message for boolean and system modes', async () => {
    const capturedPrompts: unknown[] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }: any) => {
        capturedPrompts.push(prompt);
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-system', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: '{"suggestions":["ship"]}' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsage, providerMetadata: undefined },
          ]),
          request: { body: '' },
          response: { headers: {} },
          warnings: [] as any[],
        };
      },
    });

    for (const jsonPromptInjection of [true, 'system'] as const) {
      const stream = execute({
        runId: `test-run-id-${jsonPromptInjection}`,
        model: model as any,
        inputMessages,
        onResult: () => {},
        methodType: 'stream',
        structuredOutput: {
          schema,
          jsonPromptInjection,
        },
      });
      await readStream(stream);
    }

    expect(capturedPrompts).toHaveLength(2);
    for (const capturedPrompt of capturedPrompts) {
      expect((capturedPrompt as any[])[0].role).toBe('system');
      expect(JSON.stringify((capturedPrompt as any[])[0])).toContain('suggestions');
    }
  });

  it('injects direct structured output schema into the latest user message for inline mode', async () => {
    let capturedPrompt: unknown;
    let capturedResponseFormat: unknown;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt, responseFormat }: any) => {
        capturedPrompt = prompt;
        capturedResponseFormat = responseFormat;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-inline', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: '{"suggestions":["ship"]}' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsage, providerMetadata: undefined },
          ]),
          request: { body: '' },
          response: { headers: {} },
          warnings: [] as any[],
        };
      },
    });

    const messages = [
      { role: 'system' as const, content: 'Keep this prefix stable.' },
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'First request.' }] },
      { role: 'assistant' as const, content: [{ type: 'text' as const, text: 'First response.' }] },
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'Extract now.' }] },
    ];

    const stream = execute({
      runId: 'test-run-id-inline',
      model: model as any,
      inputMessages: messages,
      onResult: () => {},
      methodType: 'stream',
      structuredOutput: {
        schema,
        jsonPromptInjection: 'inline',
      },
    });

    await readStream(stream);

    expect(capturedResponseFormat).toBeUndefined();
    expect((capturedPrompt as any[])[0]).toEqual(messages[0]);
    expect(JSON.stringify((capturedPrompt as any[])[1])).not.toContain(
      'Return your response as JSON matching this schema',
    );
    expect(JSON.stringify((capturedPrompt as any[])[3])).toContain('Return your response as JSON matching this schema');
    expect(JSON.stringify((capturedPrompt as any[])[3])).toContain('suggestions');
    expect(JSON.stringify((capturedPrompt as any[])[3])).toContain('Extract now.');
  });

  it('adds a user message for inline mode when no user message exists', async () => {
    let capturedPrompt: unknown;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }: any) => {
        capturedPrompt = prompt;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-inline-no-user', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: '{"suggestions":["ship"]}' },
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
      runId: 'test-run-id-inline-no-user',
      model: model as any,
      inputMessages: [{ role: 'system' as const, content: 'System only.' }],
      onResult: () => {},
      methodType: 'stream',
      structuredOutput: {
        schema,
        jsonPromptInjection: 'inline',
      },
    });

    await readStream(stream);

    expect((capturedPrompt as any[])[0]).toEqual({ role: 'system', content: 'System only.' });
    expect((capturedPrompt as any[])[1].role).toBe('user');
    expect(JSON.stringify((capturedPrompt as any[])[1])).toContain('Return your response as JSON matching this schema');
  });
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
