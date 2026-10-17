/**
 * Mock model factories for DurableAgent tests
 *
 * These factories create MockLanguageModelV4 instances with various
 * streaming behaviors for testing different scenarios.
 */

import type { LanguageModelV4 } from '@ai-sdk/provider';
import { MockLanguageModelV4, convertArrayToReadableStream } from '@mastra/core/ai/test';

/**
 * Create a mock model that streams a simple text response
 */
export function createTextStreamModel(text: string): LanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 20, text: 20, reasoning: undefined },
          },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as LanguageModelV4;
}

/**
 * Create a mock model that streams multiple text chunks
 */
export function createMultiChunkStreamModel(chunks: string[]): LanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        ...chunks.map(chunk => ({ type: 'text-delta' as const, id: 'text-1', delta: chunk })),
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: chunks.length * 5, text: chunks.length * 5, reasoning: undefined },
          },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as LanguageModelV4;
}

/**
 * Create a mock model that returns a single tool call
 */
export function createToolCallModel(toolName: string, args: Record<string, unknown>): LanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName,
          input: JSON.stringify(args),
          providerExecuted: false,
        },
        {
          type: 'finish',
          finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
          usage: {
            inputTokens: { total: 15, noCache: 15, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 10, text: 10, reasoning: undefined },
          },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as LanguageModelV4;
}

/**
 * Create a mock model that returns multiple tool calls
 */
export function createMultiToolCallModel(
  toolCalls: Array<{ toolName: string; args: Record<string, unknown> }>,
): LanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        ...toolCalls.map((tc, i) => ({
          type: 'tool-call' as const,
          toolCallId: `call-${i + 1}`,
          toolName: tc.toolName,
          input: JSON.stringify(tc.args),
          providerExecuted: false,
        })),
        {
          type: 'finish',
          finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
          usage: {
            inputTokens: { total: 15, noCache: 15, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 10 * toolCalls.length, text: 10 * toolCalls.length, reasoning: undefined },
          },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as LanguageModelV4;
}

/**
 * Create a mock model that first returns a tool call, then text
 * Simulates an agentic loop with tool execution followed by response
 */
export function createToolCallThenTextModel(
  toolName: string,
  args: Record<string, unknown>,
  finalText: string,
): LanguageModelV4 {
  let callCount = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName,
              input: JSON.stringify(args),
              providerExecuted: false,
            },
            {
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
              usage: {
                inputTokens: { total: 15, noCache: 15, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 10, text: 10, reasoning: undefined },
              },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      } else {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: finalText },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                inputTokens: { total: 20, noCache: 20, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 15, text: 15, reasoning: undefined },
              },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
    },
  }) as LanguageModelV4;
}

/**
 * Create a mock model that returns multiple tool calls on the first invocation
 * and a text response on the second invocation.
 * Simulates an agentic loop with parallel tool execution followed by response.
 */
export function createMultiToolCallThenTextModel(
  toolCalls: Array<{ toolName: string; args: Record<string, unknown> }>,
  finalText: string,
): LanguageModelV4 {
  let callCount = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            ...toolCalls.map((tc, i) => ({
              type: 'tool-call' as const,
              toolCallId: `call-${i + 1}`,
              toolName: tc.toolName,
              input: JSON.stringify(tc.args),
              providerExecuted: false,
            })),
            {
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
              usage: {
                inputTokens: { total: 15, noCache: 15, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 10 * toolCalls.length, text: 10 * toolCalls.length, reasoning: undefined },
              },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      } else {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: finalText },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: { unified: 'stop', raw: 'stop' },
              usage: {
                inputTokens: { total: 20, noCache: 20, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 15, text: 15, reasoning: undefined },
              },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
    },
  }) as LanguageModelV4;
}

/**
 * Create a mock model that throws an error
 */
export function createErrorModel(errorMessage: string): LanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: async () => {
      throw new Error(errorMessage);
    },
  }) as LanguageModelV4;
}

/**
 * Create a simple mock model for basic tests
 * Returns "Hello" as the response
 */
export function createSimpleMockModel(): LanguageModelV4 {
  return createTextStreamModel('Hello');
}

/**
 * Create a mock model that emits an error chunk (for fallback testing)
 * Unlike createErrorModel which throws, this returns a stream with an error chunk.
 */
export function createFailingChunkModel(errorMessage: string = 'Model execution failed'): LanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'error', error: new Error(errorMessage) },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as LanguageModelV4;
}

/**
 * Create a mock model that streams reasoning content followed by text
 * Simulates a reasoning-capable model (e.g., o1, deepseek-r1)
 */
export function createReasoningStreamModel(reasoningText: string, responseText: string): LanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-reasoning-model', timestamp: new Date(0) },
        { type: 'reasoning-start', id: 'reasoning-1' },
        { type: 'reasoning-delta', id: 'reasoning-1', delta: reasoningText },
        { type: 'reasoning-end', id: 'reasoning-1' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: {
            inputTokens: { total: 20, noCache: 20, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 30, text: 30, reasoning: undefined },
          },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as LanguageModelV4;
}

/**
 * Create a flaky mock model that fails N times then succeeds
 * Useful for testing retry logic before fallback
 */
export function createFlakyModel(failCount: number, successText: string = 'Success after retries'): LanguageModelV4 {
  let attempts = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      attempts++;
      if (attempts <= failCount) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'error', error: new Error(`Attempt ${attempts} failed`) },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: successText },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 20, text: 20, reasoning: undefined },
            },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  }) as LanguageModelV4;
}
