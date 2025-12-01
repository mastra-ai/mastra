import { openai as openai_v4 } from '@ai-sdk/openai';
import { openai as openai_v5 } from '@ai-sdk/openai-v5';
import { simulateReadableStream, MockLanguageModelV1 } from '@internal/ai-sdk-v4';
import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';

export function getOpenAIModel(version: 'v1' | 'v2') {
  if (version === 'v1') {
    return openai_v4('gpt-4o-mini');
  }
  return openai_v5('gpt-4o-mini');
}

export function getSingleDummyResponseModel(version: 'v1' | 'v2') {
  if (version === 'v1') {
    return new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: `Dummy response`,
      }),
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [{ type: 'text-delta', textDelta: 'Dummy response' }],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
  } else {
    return new MockLanguageModelV2({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [
          {
            type: 'text',
            text: 'Dummy response',
          },
        ],
        warnings: [],
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          {
            type: 'stream-start',
            warnings: [],
          },
          {
            type: 'response-metadata',
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: '1' },
          { type: 'text-delta', id: '1', delta: 'Dummy response' },
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });
  }
}

export function getDummyResponseModel(version: 'v1' | 'v2') {
  if (version === 'v1') {
    return new MockLanguageModelV1({
      doGenerate: async _options => ({
        text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
      doStream: async _options => {
        let count = 0;
        const stream = new ReadableStream({
          pull(controller) {
            if (count < 10) {
              controller.enqueue({
                type: 'text-delta',
                textDelta: `Dummy response ${count}`,
                createdAt: new Date(Date.now() + count * 1000).toISOString(),
              });
              count++;
            } else {
              controller.close();
            }
          },
        });
        return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
      },
    });
  } else {
    return new MockLanguageModelV2({
      doGenerate: async _options => ({
        text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        content: [
          {
            type: 'text',
            text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
          },
        ],
        warnings: [],
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
      doStream: async _options => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          {
            type: 'stream-start',
            warnings: [],
          },
          {
            type: 'response-metadata',
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          { type: 'text-start', id: '1' },
          ...Array.from({ length: 10 }, (_, count) => ({
            type: 'text-delta' as const,
            id: '1',
            delta: `Dummy response ${count}`,
          })),
          { type: 'text-end', id: '1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          },
        ]),
      }),
    });
  }
}

export function getEmptyResponseModel(version: 'v1' | 'v2') {
  if (version === 'v1') {
    return new MockLanguageModelV1({
      doGenerate: async _options => ({
        text: undefined,
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });
  } else {
    return new MockLanguageModelV2({
      doGenerate: async _options => ({
        text: undefined,
        finishReason: 'stop',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        content: [],
        warnings: [],
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          {
            type: 'stream-start',
            warnings: [],
          },
          {
            type: 'response-metadata',
            id: 'id-0',
            modelId: 'mock-model-id',
            timestamp: new Date(0),
          },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          },
        ]),
      }),
    });
  }
}

export function getErrorResponseModel(version: 'v1' | 'v2') {
  if (version === 'v1') {
    // Model throws immediately before emitting any part
    return new MockLanguageModelV1({
      doGenerate: async _options => {
        throw new Error('Immediate interruption');
      },
      doStream: async _options => {
        const stream = new ReadableStream({
          pull() {
            throw new Error('Immediate interruption');
          },
        });
        return { stream, rawCall: { rawPrompt: null, rawSettings: {} } };
      },
    });
  } else {
    // Model throws immediately before emitting any part
    return new MockLanguageModelV2({
      doGenerate: async _options => {
        throw new Error('Immediate interruption');
      },
      doStream: async _options => {
        throw new Error('Immediate interruption');
      },
    });
  }
}

/**
 * Creates a mock model that returns a request body with sensitive data.
 * This simulates what happens when the AI SDK returns the full request body
 * that was sent to the LLM provider.
 */
export function getModelWithSensitiveRequestData(version: 'v1' | 'v2') {
  const sensitiveSystemPrompt = 'You are a SECRET assistant with CONFIDENTIAL instructions. API_KEY=sk-secret-12345';
  const sensitiveToolDefinition = {
    type: 'function',
    name: 'secretTool',
    description: 'A tool with sensitive internal details that should not be exposed',
    parameters: {
      type: 'object',
      properties: {
        internalId: { type: 'string', description: 'Internal secret ID' },
      },
    },
  };

  // This is what the AI SDK returns - the full request body sent to the LLM
  const sensitiveRequestBody = {
    model: 'gpt-4o',
    input: [
      { role: 'system', content: sensitiveSystemPrompt },
      { role: 'user', content: [{ type: 'input_text', text: 'hello' }] },
    ],
    tools: [sensitiveToolDefinition],
    temperature: 0,
    tool_choice: 'auto',
  };

  if (version === 'v1') {
    return {
      model: new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: 'Hello! How can I help you?',
          request: { body: JSON.stringify(sensitiveRequestBody) },
        }),
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-delta', textDelta: 'Hello! How can I help you?' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
              },
            ],
          }),
          rawCall: { rawPrompt: null, rawSettings: {} },
          request: { body: JSON.stringify(sensitiveRequestBody) },
        }),
      }),
      sensitiveSystemPrompt,
      sensitiveToolDefinition,
      sensitiveRequestBody,
    };
  } else {
    return {
      model: new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [{ type: 'text', text: 'Hello! How can I help you?' }],
          warnings: [],
          request: { body: JSON.stringify(sensitiveRequestBody) },
        }),
        doStream: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          request: { body: JSON.stringify(sensitiveRequestBody) },
          response: { headers: {} },
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: '1' },
            { type: 'text-delta', id: '1', delta: 'Hello! How can I help you?' },
            { type: 'text-end', id: '1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        }),
      }),
      sensitiveSystemPrompt,
      sensitiveToolDefinition,
      sensitiveRequestBody,
    };
  }
}
