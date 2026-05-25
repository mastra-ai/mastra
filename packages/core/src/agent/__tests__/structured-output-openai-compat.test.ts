/**
 * Tests the OpenAI structured output compat layer in agent.ts against the
 * real Agent class with mock models.
 *
 * When modelId is undefined (e.g., agent networks), the compat layer must
 * still run — otherwise strict mode rejects schemas with optional fields
 * missing from the `required` array.
 *
 * These tests exercise the actual agent.ts #execute code path.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';

/** Exact schema from packages/core/src/loop/network/validation.ts:370-377 */
const defaultCompletionSchema = z.object({
  isComplete: z.boolean().describe('Whether the task is complete'),
  completionReason: z.string().describe('Explanation of why the task is or is not complete'),
  finalResult: z.string().optional().describe('The final result text to return to the user'),
});

/** Valid response matching the schema — null for optional field (OpenAI strict mode sends null, not undefined) */
const completionResponse = {
  isComplete: true,
  completionReason: 'Task completed successfully',
  finalResult: null,
};

function createMockOpenAIModel(opts: { provider?: string; modelId?: string } = {}) {
  return new MockLanguageModelV2({
    provider: opts.provider ?? 'openai.responses',
    modelId: opts.modelId,
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [{ type: 'text' as const, text: JSON.stringify(completionResponse) }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: JSON.stringify(completionResponse) },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
    }),
  });
}

describe('OpenAI compat layer in agent.ts with structured output', () => {
  it('should not crash with valid modelId', async () => {
    const model = createMockOpenAIModel({ modelId: 'gpt-4o' });
    const agent = new Agent({ id: 'test', name: 'test', instructions: 'test', model });

    const result = await agent.generate('test', {
      structuredOutput: { schema: defaultCompletionSchema },
    });

    expect(result.object).toBeDefined();
    expect(result.object.isComplete).toBe(true);
  });

  it('should not crash with undefined modelId', async () => {
    // OpenAI provider but modelId is undefined
    // (happens in agent networks when model is inherited without explicit modelId)
    const model = createMockOpenAIModel({ modelId: undefined });
    const agent = new Agent({ id: 'test', name: 'test', instructions: 'test', model });
    const result = await agent.generate('test', {
      structuredOutput: { schema: defaultCompletionSchema },
    });

    expect(result.object).toBeDefined();
    expect(result.object.isComplete).toBe(true);
  });

  it('should not crash with empty string modelId', async () => {
    const model = createMockOpenAIModel({ modelId: '' });
    const agent = new Agent({ id: 'test', name: 'test', instructions: 'test', model });

    const result = await agent.generate('test', {
      structuredOutput: { schema: defaultCompletionSchema },
    });

    expect(result.object).toBeDefined();
    expect(result.object.isComplete).toBe(true);
  });

  it('should transform optional fields to nullable (null → undefined)', async () => {
    const model = createMockOpenAIModel({ modelId: 'gpt-4o' });
    const agent = new Agent({ id: 'test', name: 'test', instructions: 'test', model });

    const result = await agent.generate('test', {
      structuredOutput: { schema: defaultCompletionSchema },
    });

    // The compat layer converts .optional() → .nullable().transform(null → undefined)
    // So `finalResult: null` in the response should become `undefined` in the parsed result
    expect(result.object.finalResult).toBeUndefined();
  });

  it('should transform optional fields even with undefined modelId', async () => {
    // The key assertion: compat layer runs AND transforms correctly even without modelId
    const model = createMockOpenAIModel({ modelId: undefined });
    const agent = new Agent({ id: 'test', name: 'test', instructions: 'test', model });

    const result = await agent.generate('test', {
      structuredOutput: { schema: defaultCompletionSchema },
    });

    expect(result.object.finalResult).toBeUndefined();
  });
});
