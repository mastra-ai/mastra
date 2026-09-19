import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { coreFeatures } from '../../../features';
import { execute, resolveJsonPromptInjection } from './execute';
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
  it('resolves automatic prompt injection from tri-state capability data', () => {
    expect(resolveJsonPromptInjection('auto', true)).toBeUndefined();
    expect(resolveJsonPromptInjection('auto', false)).toBe('inline');
    expect(resolveJsonPromptInjection('auto', undefined)).toBe('inline');
    expect(resolveJsonPromptInjection('system', undefined)).toBe('system');
  });

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

  it('injects processor schema instructions into the main system prompt by default and when system injection is requested', async () => {
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

    for (const jsonPromptInjection of [undefined, 'system'] as const) {
      const stream = execute({
        runId: `test-run-id-processor-${jsonPromptInjection ?? 'default'}`,
        model: model as any,
        inputMessages,
        onResult: () => {},
        methodType: 'stream',
        structuredOutput: {
          schema,
          model: model as any,
          jsonPromptInjection,
        },
      });

      await readStream(stream);

      expect(capturedPrompt).not.toEqual(inputMessages);
      const promptJson = JSON.stringify(capturedPrompt);
      expect(promptJson).toContain('Your response will be processed by another agent to extract structured data');
      expect(promptJson).toContain('suggestions');
    }
  });

  it('does not inject processor schema instructions into the main prompt when injection is disabled', async () => {
    let capturedPrompt: unknown;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }: any) => {
        capturedPrompt = prompt;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: 'id-processor-disabled',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
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
      runId: 'test-run-id-processor-disabled',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      structuredOutput: {
        schema,
        model: model as any,
        jsonPromptInjection: false,
      },
    });

    await readStream(stream);

    expect(capturedPrompt).toEqual(inputMessages);
    expect(JSON.stringify(capturedPrompt)).not.toContain(
      'Your response will be processed by another agent to extract structured data',
    );
  });

  it('injects processor schema instructions into the latest user message for inline mode', async () => {
    let capturedPrompt: unknown;
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }: any) => {
        capturedPrompt = prompt;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-processor-inline', modelId: 'mock-model-id', timestamp: new Date(0) },
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
      runId: 'test-run-id-processor-inline',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      structuredOutput: {
        schema,
        model: model as any,
        jsonPromptInjection: 'inline',
      },
    });

    await readStream(stream);

    expect(capturedPrompt).not.toEqual(inputMessages);
    expect(capturedPrompt as any[]).toHaveLength(inputMessages.length);
    expect((capturedPrompt as any[])[0].role).toBe('user');
    const promptJson = JSON.stringify(capturedPrompt);
    expect(promptJson).toContain('Summarize the plan.');
    expect(promptJson).toContain('Your response will be processed by another agent to extract structured data');
    expect(promptJson).toContain('suggestions');
    expect(promptJson).toContain("You don't need to format your response as JSON unless the user asks you to.");
  });
});

describe('execute compact structuredOutput.instructions (issue #23798)', () => {
  const INLINE_SCHEMA_PREFIX = 'Return your response as JSON matching this schema';
  const SYSTEM_SCHEMA_PREFIX = 'JSON schema:';
  const SENTINEL = '__mastra23798Sentinel';
  const INSTRUCTIONS = 'FIELDS: a,b';
  const sentinelSchema = z.object({
    __mastra23798Sentinel: z.string(),
  });

  function makeCapturingModel() {
    const captured: { prompt?: any } = {};
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }: any) => {
        captured.prompt = prompt;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-23798', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: '{"__mastra23798Sentinel":"ok"}' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsage, providerMetadata: undefined },
          ]),
          request: { body: '' },
          response: { headers: {} },
          warnings: [] as any[],
        };
      },
    });
    return { model, captured };
  }

  async function run({ messages, structuredOutput, runId }: { messages: any[]; structuredOutput: any; runId: string }) {
    const { model, captured } = makeCapturingModel();
    const stream = execute({
      runId,
      model: model as any,
      inputMessages: messages,
      onResult: () => {},
      methodType: 'stream',
      structuredOutput,
    });
    await readStream(stream);
    return captured.prompt as any[];
  }

  it('substitutes instructions for the schema dump in the leading system message', async () => {
    const prompt = await run({
      runId: 'test-run-23798-system',
      messages: [
        { role: 'system' as const, content: 'Keep this prefix stable.' },
        { role: 'user' as const, content: [{ type: 'text' as const, text: 'Extract now.' }] },
      ],
      structuredOutput: { schema: sentinelSchema, jsonPromptInjection: 'system', instructions: INSTRUCTIONS },
    });

    expect(prompt[0]).toEqual({ role: 'system', content: `Keep this prefix stable.\n\n${INSTRUCTIONS}` });
    const promptJson = JSON.stringify(prompt);
    expect(promptJson).not.toContain(INLINE_SCHEMA_PREFIX);
    expect(promptJson).not.toContain(SYSTEM_SCHEMA_PREFIX);
    expect(promptJson).not.toContain(SENTINEL);
  });

  it("substitutes instructions when 'auto' resolves to injection on a model without native support", async () => {
    const prompt = await run({
      runId: 'test-run-23798-auto',
      messages: [
        { role: 'system' as const, content: 'Keep this prefix stable.' },
        { role: 'user' as const, content: [{ type: 'text' as const, text: 'Extract now.' }] },
      ],
      structuredOutput: { schema: sentinelSchema, jsonPromptInjection: 'auto', instructions: INSTRUCTIONS },
    });

    // 'auto' resolves to inline injection when capability data says the model has no native
    // structured output, so the compact text lands on the latest user message.
    const promptJson = JSON.stringify(prompt);
    expect(promptJson).toContain(INSTRUCTIONS);
    expect(prompt[0]).toEqual({ role: 'system', content: 'Keep this prefix stable.' });
    expect(promptJson).not.toContain(INLINE_SCHEMA_PREFIX);
    expect(promptJson).not.toContain(SYSTEM_SCHEMA_PREFIX);
    expect(promptJson).not.toContain(SENTINEL);
  });

  it('creates a system message carrying the instructions when none exists', async () => {
    const prompt = await run({
      runId: 'test-run-23798-system-none',
      messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Extract now.' }] }],
      structuredOutput: { schema: sentinelSchema, jsonPromptInjection: true, instructions: INSTRUCTIONS },
    });

    expect(prompt[0]).toEqual({ role: 'system', content: INSTRUCTIONS });
    expect(prompt[1]).toEqual({ role: 'user', content: [{ type: 'text', text: 'Extract now.' }] });
    const promptJson = JSON.stringify(prompt);
    expect(promptJson).not.toContain(INLINE_SCHEMA_PREFIX);
    expect(promptJson).not.toContain(SYSTEM_SCHEMA_PREFIX);
    expect(promptJson).not.toContain(SENTINEL);
  });

  it('substitutes instructions for the schema dump in the latest user message for inline mode', async () => {
    const messages = [
      { role: 'system' as const, content: 'Keep this prefix stable.' },
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'First request.' }] },
      { role: 'assistant' as const, content: [{ type: 'text' as const, text: 'First response.' }] },
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'Extract now.' }] },
    ];
    const prompt = await run({
      runId: 'test-run-23798-inline',
      messages,
      structuredOutput: { schema: sentinelSchema, jsonPromptInjection: 'inline', instructions: INSTRUCTIONS },
    });

    expect(prompt[0]).toEqual(messages[0]);
    expect(prompt[3].content.at(-1)).toEqual({ type: 'text', text: INSTRUCTIONS });
    const promptJson = JSON.stringify(prompt);
    expect(promptJson).not.toContain(INLINE_SCHEMA_PREFIX);
    expect(promptJson).not.toContain(SYSTEM_SCHEMA_PREFIX);
    expect(promptJson).not.toContain(SENTINEL);
  });

  it('adds a user message carrying the instructions for inline mode when no user message exists', async () => {
    const prompt = await run({
      runId: 'test-run-23798-inline-none',
      messages: [{ role: 'system' as const, content: 'System only.' }],
      structuredOutput: { schema: sentinelSchema, jsonPromptInjection: 'inline', instructions: INSTRUCTIONS },
    });

    expect(prompt[0]).toEqual({ role: 'system', content: 'System only.' });
    expect(prompt[1]).toEqual({ role: 'user', content: [{ type: 'text', text: INSTRUCTIONS }] });
    const promptJson = JSON.stringify(prompt);
    expect(promptJson).not.toContain(INLINE_SCHEMA_PREFIX);
    expect(promptJson).not.toContain(SYSTEM_SCHEMA_PREFIX);
    expect(promptJson).not.toContain(SENTINEL);
  });

  it('falls back to the generated schema instruction for whitespace-only instructions', async () => {
    const messages = [
      { role: 'system' as const, content: 'Keep this prefix stable.' },
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'Extract now.' }] },
    ];
    const withWhitespace = await run({
      runId: 'test-run-23798-blank',
      messages,
      structuredOutput: { schema: sentinelSchema, jsonPromptInjection: 'system', instructions: '   ' },
    });
    const withNone = await run({
      runId: 'test-run-23798-none',
      messages,
      structuredOutput: { schema: sentinelSchema, jsonPromptInjection: 'system' },
    });

    expect(JSON.stringify(withWhitespace)).toBe(JSON.stringify(withNone));
    expect(JSON.stringify(withWhitespace)).toContain(SYSTEM_SCHEMA_PREFIX);
    expect(JSON.stringify(withWhitespace)).toContain(SENTINEL);
  });

  it('does not substitute instructions on the processor path', async () => {
    const { model: structuringModel } = makeCapturingModel();
    const prompt = await run({
      runId: 'test-run-23798-processor',
      messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Extract now.' }] }],
      structuredOutput: {
        schema: sentinelSchema,
        model: structuringModel as any,
        jsonPromptInjection: 'system',
        instructions: INSTRUCTIONS,
      },
    });

    const promptJson = JSON.stringify(prompt);
    expect(promptJson).toContain('Your response will be processed by another agent to extract structured data');
    expect(promptJson).toContain(SENTINEL);
    expect(promptJson).not.toContain(INSTRUCTIONS);
  });
});

describe('execute sampling-param stripping (issue #23319)', () => {
  function makeCapturingModel(provider: string, modelId: string) {
    const captured: { options?: any } = {};
    const model = new MockLanguageModelV2({
      provider,
      modelId,
      doStream: async (options: any) => {
        captured.options = options;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-strip', modelId, timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'ok' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: testUsage, providerMetadata: undefined },
          ]),
          request: { body: '' },
          response: { headers: {} },
          warnings: [] as any[],
        };
      },
    });
    return { model, captured };
  }

  async function run(model: MockLanguageModelV2) {
    const stream = execute({
      runId: 'test-run-id-strip',
      model: model as any,
      inputMessages,
      onResult: () => {},
      methodType: 'stream',
      modelSettings: { temperature: 0, topP: 0.5, topK: 10 } as any,
    });
    await readStream(stream);
  }

  it('strips temperature/topP/topK for provider-instance models that reject them', async () => {
    // gpt-5-pro is not in openai's temperature capability list → sampling params dropped.
    const { model, captured } = makeCapturingModel('openai', 'gpt-5-pro');
    await run(model);
    expect(captured.options.temperature).toBeUndefined();
    expect(captured.options.topP).toBeUndefined();
    expect(captured.options.topK).toBeUndefined();
  });

  it('keeps sampling params for models that support temperature', async () => {
    const { model, captured } = makeCapturingModel('openai', 'gpt-4o');
    await run(model);
    expect(captured.options.temperature).toBe(0);
    expect(captured.options.topP).toBe(0.5);
    expect(captured.options.topK).toBe(10);
  });

  it('keeps sampling params when capability data is unknown (undefined, not false)', async () => {
    const { model, captured } = makeCapturingModel('mock-provider', 'mock-model-id');
    await run(model);
    expect(captured.options.temperature).toBe(0);
    expect(captured.options.topP).toBe(0.5);
    expect(captured.options.topK).toBe(10);
  });
});
