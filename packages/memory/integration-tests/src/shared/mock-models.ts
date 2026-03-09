/**
 * Shared mock model utilities for deterministic, fast, and free testing.
 *
 * These mocks properly populate `response.request.body` so existing test assertions work unchanged.
 */

export interface MockModelConfig {
  MockLanguageModel: any;
  convertArrayToReadableStream: (arr: any[]) => ReadableStream;
}

/**
 * Creates a mock model that returns a simple text response.
 * The mock properly populates rawCall.rawPrompt so that response.request.body is populated.
 *
 * @param config - Mock model utilities from AI SDK test package
 * @param responseText - The text response to return (default: 'I understand.')
 */
export function createMockModel(config: MockModelConfig, responseText: string = 'I understand.') {
  const { MockLanguageModel, convertArrayToReadableStream } = config;

  return new MockLanguageModel({
    doGenerate: async (options: any) => {
      const prompt = options.prompt || options.messages || [];
      return {
        // rawPrompt is used by AI SDK to populate response.request.body
        rawCall: { rawPrompt: prompt, rawSettings: {} },
        request: { body: { input: prompt } },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        warnings: [],
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    },
    doStream: async (options: any) => {
      const prompt = options.prompt || options.messages || [];
      return {
        rawCall: { rawPrompt: prompt, rawSettings: {} },
        request: { body: { input: prompt } },
        warnings: [],
        stream: convertArrayToReadableStream([
          {
            type: 'text-delta',
            id: 'text-1',
            delta: responseText,
          },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
        ]),
      };
    },
  });
}

/**
 * Creates a mock model that simulates tool calls.
 * Useful for testing tool-related functionality like ToolCallFilter.
 *
 * @param config - Mock model utilities from AI SDK test package
 * @param toolCalls - Array of tool call configurations
 */
export function createMockModelWithToolCalls(
  config: MockModelConfig,
  toolCalls: Array<{
    toolName: string;
    toolCallId: string;
    args: Record<string, any>;
    result: string;
  }>,
) {
  const { MockLanguageModel, convertArrayToReadableStream } = config;

  return new MockLanguageModel({
    doGenerate: async (options: any) => {
      const prompt = options.prompt || options.messages || [];

      // Build content with tool calls
      const content: any[] = toolCalls.map(tc => ({
        type: 'tool-call',
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: tc.args,
      }));

      // Add a text response after tool calls
      content.push({
        type: 'text',
        text: 'Tool calls completed.',
      });

      return {
        rawCall: { rawPrompt: prompt, rawSettings: {} },
        request: { body: { input: prompt } },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        warnings: [],
        content,
      };
    },
    doStream: async (options: any) => {
      const prompt = options.prompt || options.messages || [];

      // Build stream chunks with tool calls
      const chunks: any[] = [];

      for (const tc of toolCalls) {
        chunks.push({
          type: 'tool-call',
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args,
        });
      }

      chunks.push({
        type: 'text-delta',
        id: 'text-1',
        delta: 'Tool calls completed.',
      });

      chunks.push({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });

      return {
        rawCall: { rawPrompt: prompt, rawSettings: {} },
        request: { body: { input: prompt } },
        warnings: [],
        stream: convertArrayToReadableStream(chunks),
      };
    },
  });
}

/**
 * Creates a mock model that returns multiple sequential responses.
 * Useful for multi-turn conversation testing.
 *
 * @param config - Mock model utilities from AI SDK test package
 * @param responses - Array of response texts to return in sequence
 */
export function createMockModelWithSequence(config: MockModelConfig, responses: string[]) {
  const { MockLanguageModel, convertArrayToReadableStream } = config;
  let callIndex = 0;

  return new MockLanguageModel({
    doGenerate: async (options: any) => {
      const prompt = options.prompt || options.messages || [];
      const responseText = responses[callIndex % responses.length];
      callIndex++;

      return {
        rawCall: { rawPrompt: prompt, rawSettings: {} },
        request: { body: { input: prompt } },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        warnings: [],
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    },
    doStream: async (options: any) => {
      const prompt = options.prompt || options.messages || [];
      const responseText = responses[callIndex % responses.length];
      callIndex++;

      return {
        rawCall: { rawPrompt: prompt, rawSettings: {} },
        request: { body: { input: prompt } },
        warnings: [],
        stream: convertArrayToReadableStream([
          {
            type: 'text-delta',
            id: 'text-1',
            delta: responseText,
          },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
        ]),
      };
    },
  });
}
