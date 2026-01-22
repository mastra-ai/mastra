/**
 * Mock model factories for DurableAgent tests
 *
 * These factories create MockLanguageModelV2 instances with various
 * streaming behaviors for testing different scenarios.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';

/**
 * Create a mock model that streams a simple text response
 */
export function createTextStreamModel(text: string): LanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as LanguageModelV2;
}

/**
 * Create a mock model that streams multiple text chunks
 */
export function createMultiChunkStreamModel(chunks: string[]): LanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        ...chunks.map(chunk => ({ type: 'text-delta' as const, id: 'text-1', delta: chunk })),
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: chunks.length * 5, totalTokens: 10 + chunks.length * 5 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as LanguageModelV2;
}

/**
 * Create a mock model that returns a single tool call
 */
export function createToolCallModel(toolName: string, args: Record<string, unknown>): LanguageModelV2 {
  return new MockLanguageModelV2({
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
          finishReason: 'tool-calls',
          usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as LanguageModelV2;
}

/**
 * Create a mock model that returns multiple tool calls
 */
export function createMultiToolCallModel(
  toolCalls: Array<{ toolName: string; args: Record<string, unknown> }>,
): LanguageModelV2 {
  return new MockLanguageModelV2({
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
          finishReason: 'tool-calls',
          usage: { inputTokens: 15, outputTokens: 10 * toolCalls.length, totalTokens: 15 + 10 * toolCalls.length },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as LanguageModelV2;
}

/**
 * Create a mock model that first returns a tool call, then text
 * Simulates an agentic loop with tool execution followed by response
 */
export function createToolCallThenTextModel(
  toolName: string,
  args: Record<string, unknown>,
  finalText: string,
): LanguageModelV2 {
  let callCount = 0;
  return new MockLanguageModelV2({
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
              finishReason: 'tool-calls',
              usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
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
              finishReason: 'stop',
              usage: { inputTokens: 20, outputTokens: 15, totalTokens: 35 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      }
    },
  }) as LanguageModelV2;
}

/**
 * Create a mock model that throws an error
 */
export function createErrorModel(errorMessage: string): LanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => {
      throw new Error(errorMessage);
    },
  }) as LanguageModelV2;
}

/**
 * Create a simple mock model for basic tests
 * Returns "Hello" as the response
 */
export function createSimpleMockModel(): LanguageModelV2 {
  return createTextStreamModel('Hello');
}
