import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { Agent } from '../agent';

/**
 * Reproduction tests for issue #13012:
 * "structuredOutput + generate() causes runaway token generation in step 2"
 *
 * Root cause: When using structuredOutput + tools, the model may call a tool
 * in step 1 (finishReason: 'tool-calls'). In step 2, the model receives tool
 * results and generates a response with finishReason: 'length' (hit max output
 * tokens). The framework treats 'length' as a continuation signal because only
 * 'stop' and 'error' are treated as termination conditions:
 *
 *   isContinued: !['stop', 'error'].includes(finishReason)
 *
 * This means 'length' → isContinued=true → loop continues → step 3 → more tokens
 * → step 4 → etc. until maxSteps is exhausted, burning tokens on every iteration.
 *
 * The fix should treat finishReason: 'length' as a termination condition to
 * prevent runaway loops when the model hits max output tokens.
 */
describe('structuredOutput + generate() with tools (#13012)', () => {
  const outputSchema = z.object({
    name: z.string(),
    summary: z.string(),
    score: z.number(),
  });

  const expectedOutput = {
    name: 'Test Result',
    summary: 'A comprehensive test result',
    score: 95,
  };

  // A simple tool that the model might call before generating structured output
  const lookupTool = createTool({
    id: 'lookup',
    description: 'Look up information',
    inputSchema: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      return { found: true, data: `Result for: ${query}` };
    },
  });

  /**
   * Core reproduction: finishReason 'length' causes runaway loop.
   *
   * Step 1: Model calls a tool (finishReason: 'tool-calls') → loop continues
   * Step 2: Model generates valid-looking JSON but hits max output tokens
   *   (finishReason: 'length'). The JSON happens to pass schema validation.
   * BUG: The framework does NOT treat 'length' as a stop condition, so:
   * Step 3: Loop continues, model generates MORE tokens
   * Step 4, 5, ... repeat until maxSteps is exhausted
   *
   * The model should only be called twice: once for the tool call, once for the
   * response. After finishReason: 'length', the loop should stop.
   */
  it('should stop the loop when model hits max output tokens (finishReason: length) after tool call', async () => {
    let callCount = 0;

    const mockModel = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        callCount++;

        const hasToolResults = prompt.some(
          (msg: any) =>
            msg.role === 'tool' ||
            (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
        );

        if (!hasToolResults) {
          // Step 1: Model calls a tool
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: 'call-1',
                toolName: 'lookup',
                args: { query: 'test data' },
              },
            ],
            warnings: [],
          };
        } else {
          // Step 2+: Model generates valid JSON but with finishReason: 'length'
          // (hit max output tokens). This simulates the model generating excessive
          // tokens that happen to form valid JSON.
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'length' as const,
            usage: { inputTokens: 100, outputTokens: 64000, totalTokens: 64100 },
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(expectedOutput),
              },
            ],
            warnings: [],
          };
        }
      },
      doStream: async ({ prompt }) => {
        callCount++;

        const hasToolResults = prompt.some(
          (msg: any) =>
            msg.role === 'tool' ||
            (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
        );

        if (!hasToolResults) {
          // Step 1: Model calls a tool
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'lookup',
                input: JSON.stringify({ query: 'test data' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        } else {
          // Step 2+: Model generates valid JSON but hits max output tokens
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: `id-${callCount}`,
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start', id: `text-${callCount}` },
              { type: 'text-delta', id: `text-${callCount}`, delta: JSON.stringify(expectedOutput) },
              { type: 'text-end', id: `text-${callCount}` },
              {
                type: 'finish',
                finishReason: 'length', // Hit max output tokens
                usage: { inputTokens: 100, outputTokens: 64000, totalTokens: 64100 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }
      },
    });

    const agent = new Agent({
      id: 'test-length-stop',
      name: 'Test Agent',
      instructions: 'Look up information and return structured results.',
      model: mockModel,
      tools: { lookup: lookupTool },
    });

    await agent.generate('Look up test data and summarize', {
      maxSteps: 10, // High maxSteps — the loop should stop on its own after 'length'
      structuredOutput: { schema: outputSchema },
    });

    // BUG: Without the fix, the model would be called up to 10 times (maxSteps),
    // each time generating 64K tokens (640K total wasted tokens).
    // With the fix, the model should only be called 2 times:
    // Step 1 (tool call) + Step 2 (length-terminated response).
    expect(callCount).toBeLessThanOrEqual(2);
  });

  /**
   * finishReason 'length' should stop the loop even without tools.
   *
   * If the model generates text that hits the max output token limit on the
   * very first call, the loop should not continue.
   */
  it('should stop the loop when model hits max output tokens (finishReason: length) - no tools', async () => {
    let callCount = 0;

    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => {
        callCount++;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'length' as const,
          usage: { inputTokens: 10, outputTokens: 64000, totalTokens: 64010 },
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(expectedOutput),
            },
          ],
          warnings: [],
        };
      },
      doStream: async () => {
        callCount++;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            {
              type: 'text-delta',
              id: 'text-1',
              delta: JSON.stringify(expectedOutput),
            },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'length',
              usage: { inputTokens: 10, outputTokens: 64000, totalTokens: 64010 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'test-length-stop-no-tools',
      name: 'Test Agent',
      instructions: 'Return structured results.',
      model: mockModel,
    });

    await agent.generate('Summarize this data', {
      maxSteps: 10,
      structuredOutput: { schema: outputSchema },
    });

    // finishReason: 'length' should stop the loop immediately.
    // Without the fix, the model is called up to 10 times (maxSteps).
    expect(callCount).toBe(1);
  });

  /**
   * finishReason 'length' causes runaway with stream API too.
   */
  it('should stop the loop when model hits max output tokens (finishReason: length) - stream', async () => {
    let callCount = 0;

    const mockModel = new MockLanguageModelV2({
      doStream: async () => {
        callCount++;
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: `id-${callCount}`,
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: `text-${callCount}` },
            {
              type: 'text-delta',
              id: `text-${callCount}`,
              delta: JSON.stringify(expectedOutput),
            },
            { type: 'text-end', id: `text-${callCount}` },
            {
              type: 'finish',
              finishReason: 'length',
              usage: { inputTokens: 10, outputTokens: 64000, totalTokens: 64010 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'test-length-stop-stream',
      name: 'Test Agent',
      instructions: 'Return structured results.',
      model: mockModel,
    });

    const stream = await agent.stream('Summarize this data', {
      maxSteps: 10,
      structuredOutput: { schema: outputSchema },
    });

    await stream.consumeStream();

    // finishReason: 'length' should stop the loop immediately.
    expect(callCount).toBe(1);
  });

  /**
   * Verify the happy path still works: tool call in step 1, structured JSON in step 2.
   */
  it('should return structured output when model calls tools before generating JSON (generate)', async () => {
    const mockModel = new MockLanguageModelV2({
      doGenerate: async ({ prompt }) => {
        const hasToolResults = prompt.some(
          (msg: any) =>
            msg.role === 'tool' ||
            (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
        );

        if (!hasToolResults) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: 'call-1',
                toolName: 'lookup',
                args: { query: 'test data' },
              },
            ],
            warnings: [],
          };
        } else {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'stop' as const,
            usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(expectedOutput),
              },
            ],
            warnings: [],
          };
        }
      },
      doStream: async ({ prompt }) => {
        const hasToolResults = prompt.some(
          (msg: any) =>
            msg.role === 'tool' ||
            (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
        );

        if (!hasToolResults) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'lookup',
                input: JSON.stringify({ query: 'test data' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        } else {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: JSON.stringify(expectedOutput) },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }
      },
    });

    const agent = new Agent({
      id: 'test-structured-output-tools',
      name: 'Test Agent',
      instructions: 'Look up information and return structured results.',
      model: mockModel,
      tools: { lookup: lookupTool },
    });

    const result = await agent.generate('Look up test data and summarize', {
      maxSteps: 5,
      structuredOutput: { schema: outputSchema },
    });

    expect(result.object).toBeDefined();
    expect(result.object).toMatchObject(expectedOutput);
  });

  /**
   * Verify the happy path for stream: tool call in step 1, structured JSON in step 2.
   */
  it('should return structured output when model calls tools before generating JSON (stream)', async () => {
    const mockModel = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        const hasToolResults = prompt.some(
          (msg: any) =>
            msg.role === 'tool' ||
            (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
        );

        if (!hasToolResults) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'lookup',
                input: JSON.stringify({ query: 'test data' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        } else {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: JSON.stringify(expectedOutput) },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 20, outputTokens: 30, totalTokens: 50 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }
      },
    });

    const agent = new Agent({
      id: 'test-structured-output-tools-stream',
      name: 'Test Agent',
      instructions: 'Look up information and return structured results.',
      model: mockModel,
      tools: { lookup: lookupTool },
    });

    const stream = await agent.stream('Look up test data and summarize', {
      maxSteps: 5,
      structuredOutput: { schema: outputSchema },
    });

    const object = await stream.object;

    expect(object).toBeDefined();
    expect(object).toMatchObject(expectedOutput);
  });

  /**
   * Edge case: with maxSteps: 1 and a tool call, the framework should
   * complete gracefully without hanging or throwing.
   */
  it('should handle maxSteps: 1 gracefully when model calls tools instead of generating JSON', async () => {
    const mockModel = new MockLanguageModelV2({
      doGenerate: async () => {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'call-1',
              toolName: 'lookup',
              args: { query: 'test data' },
            },
          ],
          warnings: [],
        };
      },
      doStream: async () => {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'lookup',
              input: JSON.stringify({ query: 'test data' }),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 15, totalTokens: 25 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    const agent = new Agent({
      id: 'test-maxsteps-1',
      name: 'Test Agent',
      instructions: 'Look up information and return structured results.',
      model: mockModel,
      tools: { lookup: lookupTool },
    });

    const result = await agent.generate('Look up test data and summarize', {
      maxSteps: 1,
      structuredOutput: { schema: outputSchema },
    });

    // Should complete without hanging
    expect(result.toolCalls.length).toBeGreaterThan(0);
  });
});
