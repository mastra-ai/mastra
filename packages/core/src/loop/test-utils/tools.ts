import { jsonSchema, stepCountIs } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, mockValues, mockId } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { loop } from '../loop';
import {
  createMessageListWithUserMessage,
  createTestModels,
  defaultSettings,
  expectPromptWithoutMastraCreatedAt,
  testUsage,
} from './utils';
import { convertAsyncIterableToArray } from './stream-helpers';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from './MastraLanguageModelV2Mock';

export function toolsTests({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  describe('tool callbacks', () => {
    it('should invoke callbacks in the correct order', async () => {
      const messageList = createMessageListWithUserMessage();
      const recordedCalls: unknown[] = [];

      const result = await loopFn({
        methodType: 'stream',
        runId,
        agentId: 'agent-id',
        models: createTestModels({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'tool-input-start',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              toolName: 'test-tool',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: '{"',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: 'value',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: '":"',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: 'Spark',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: 'le',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: ' Day',
            },
            {
              type: 'tool-input-delta',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              delta: '"}',
            },
            {
              type: 'tool-input-end',
              id: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
            },
            {
              type: 'tool-call',
              toolCallId: 'call_O17Uplv4lJvD6DVdIvFFeRMw',
              toolName: 'test-tool',
              input: '{"value":"Sparkle Day"}',
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          'test-tool': {
            inputSchema: jsonSchema<{ value: string }>({
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
            }),
            onInputAvailable: (options: any) => {
              recordedCalls.push({ type: 'onInputAvailable', options });
            },
            onInputStart: (options: any) => {
              recordedCalls.push({ type: 'onInputStart', options });
            },
            onInputDelta: (options: any) => {
              recordedCalls.push({ type: 'onInputDelta', options });
            },
          },
        },
        toolChoice: 'required',
        messageList,
        _internal: {
          now: mockValues(0, 100, 500),
        },
      });

      await result.consumeStream();

      expect(recordedCalls).toMatchInlineSnapshot(`
        [
          {
            "options": {
              "abortSignal": undefined,
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": {
                        "mastra": {
                          "createdAt": 1704067200000,
                        },
                      },
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputStart",
          },
          {
            "options": {
              "abortSignal": undefined,
              "inputTextDelta": "{"",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": {
                        "mastra": {
                          "createdAt": 1704067200000,
                        },
                      },
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "inputTextDelta": "value",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": {
                        "mastra": {
                          "createdAt": 1704067200000,
                        },
                      },
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "inputTextDelta": "":"",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": {
                        "mastra": {
                          "createdAt": 1704067200000,
                        },
                      },
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "inputTextDelta": "Spark",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": {
                        "mastra": {
                          "createdAt": 1704067200000,
                        },
                      },
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "inputTextDelta": "le",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": {
                        "mastra": {
                          "createdAt": 1704067200000,
                        },
                      },
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "inputTextDelta": " Day",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": {
                        "mastra": {
                          "createdAt": 1704067200000,
                        },
                      },
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "inputTextDelta": ""}",
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": {
                        "mastra": {
                          "createdAt": 1704067200000,
                        },
                      },
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputDelta",
          },
          {
            "options": {
              "abortSignal": undefined,
              "input": {
                "value": "Sparkle Day",
              },
              "messages": [
                {
                  "content": [
                    {
                      "providerOptions": {
                        "mastra": {
                          "createdAt": 1704067200000,
                        },
                      },
                      "text": "test-input",
                      "type": "text",
                    },
                  ],
                  "role": "user",
                },
              ],
              "toolCallId": "call_O17Uplv4lJvD6DVdIvFFeRMw",
            },
            "type": "onInputAvailable",
          },
        ]
      `);
    });
  });

  describe('tools with custom schema', () => {
    it('should send tool calls', async () => {
      const messageList = createMessageListWithUserMessage();
      const result = await loopFn({
        methodType: 'stream',
        runId,
        agentId: 'agent-id',
        models: [
          {
            maxRetries: 0,
            id: 'test-model',
            model: new MockLanguageModelV2({
              doStream: async ({ prompt, tools, toolChoice }) => {
                expect(tools).toStrictEqual([
                  {
                    type: 'function',
                    name: 'tool1',
                    description: undefined,
                    inputSchema: {
                      additionalProperties: false,
                      properties: { value: { type: 'string' } },
                      required: ['value'],
                      type: 'object',
                    },
                    providerOptions: undefined,
                  },
                ]);

                expect(toolChoice).toStrictEqual({ type: 'required' });

                expectPromptWithoutMastraCreatedAt(prompt, [
                  {
                    role: 'user',
                    content: [{ type: 'text', text: 'test-input' }],
                  },
                ]);

                return {
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'id-0',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                    {
                      type: 'tool-call',
                      toolCallId: 'call-1',
                      toolName: 'tool1',
                      input: `{ "value": "value" }`,
                    },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: testUsage,
                    },
                  ]),
                };
              },
            }),
          },
        ],
        tools: {
          tool1: {
            inputSchema: jsonSchema<{ value: string }>({
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
            }),
          },
        },
        toolChoice: 'required',
        messageList,
        _internal: {
          now: mockValues(0, 100, 500),
          generateId: mockId({ prefix: 'id' }),
        },
      });

      expect(await convertAsyncIterableToArray(result.fullStream as any)).toMatchSnapshot();
    });
  });

  describe('providerExecuted tools should not be re-executed', () => {
    it('should handle Claude Code SDK-style provider-executed tools', async () => {
      // This test simulates the exact scenario from issue #7558
      const result = loopFn({
        methodType: 'stream',
        runId,
        messageList: createMessageListWithUserMessage(),
        models: createTestModels({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'claude-code-model',
              timestamp: new Date(0),
            },
            // Simulate Claude Code SDK's file reading tool
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'str_replace_editor',
              input: JSON.stringify({
                command: 'view',
                path: '/src/app.ts',
                view_range: [1, 50],
              }),
              providerExecuted: true,
            },
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'str_replace_editor',
              result: {
                content: '// app.ts file content\nexport function main() {\n  console.log("Hello");\n}',
                line_count: 4,
              },
              providerExecuted: true,
            },
            {
              type: 'text-delta',
              id: 'text-1',
              delta: 'I can see your app.ts file. It contains a main function that logs "Hello".',
            },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        }),
        tools: {},
        ...defaultSettings(),
      });

      // Should complete without "tool not found" error
      const stream = result.fullStream;
      const chunks = await convertAsyncIterableToArray(stream);

      // Verify tool-result chunk exists with provider output
      const toolResultChunk = chunks.find((c: any) => c.type === 'tool-result');
      expect(toolResultChunk).toBeDefined();
      // as any because we're testing a case where there's a provider defined tool that's not added to tools: {} in agent definition, so there's no output type
      expect((toolResultChunk as any)?.payload?.result).toEqual({
        content: '// app.ts file content\nexport function main() {\n  console.log("Hello");\n}',
        line_count: 4,
      });
      expect((toolResultChunk as any)?.payload?.providerExecuted).toBe(true);

      // Verify we also get the text response
      const textChunks = chunks.filter((c: any) => c.type === 'text-delta');
      expect(textChunks.length).toBeGreaterThan(0);
    });

    it('should persist provider-executed tool calls in stream order with results', async () => {
      const messageList = createMessageListWithUserMessage();
      const result = loopFn({
        methodType: 'stream',
        runId,
        messageList,
        models: createTestModels({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'claude-code-model',
              timestamp: new Date(0),
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Before the tool. ' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'web_search',
              input: JSON.stringify({ query: 'mastra tools' }),
              providerExecuted: true,
            },
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'web_search',
              result: {
                results: [{ url: 'https://example.com', title: 'Example' }],
              },
              providerExecuted: true,
            },
            { type: 'text-start', id: 'text-2' },
            { type: 'text-delta', id: 'text-2', delta: 'After the tool.' },
            { type: 'text-end', id: 'text-2' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        }),
        tools: {},
        ...defaultSettings(),
      });

      await result.consumeStream();

      const responseMessages = messageList.get.response.db();
      const assistantMsg = responseMessages.find(
        msg => msg.role === 'assistant' && msg.content.parts.some(p => p.type === 'tool-invocation'),
      );
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg?.content.metadata).toEqual({
        modelId: 'mock-model-id',
        provider: 'mock-provider',
      });

      const parts = assistantMsg!.content.parts;
      expect(parts.map(part => part.type)).toEqual(['text', 'tool-invocation', 'step-start', 'text']);

      const toolPart = parts.find(part => part.type === 'tool-invocation') as
        | { toolInvocation: { state: string; result?: unknown } }
        | undefined;
      expect(toolPart?.toolInvocation.state).toBe('result');
      expect(toolPart?.toolInvocation.result).toEqual({
        results: [{ url: 'https://example.com', title: 'Example' }],
      });
    });

    it('should complete stream when PTC sends only tool-input streaming (no explicit tool-call chunk)', async () => {
      // Regression: PTC from code execution sends tool-input-start/delta/end only;
      // without synthesizing a tool-call the stream would freeze.
      const result = loopFn({
        methodType: 'stream',
        runId,
        messageList: createMessageListWithUserMessage(),
        models: createTestModels({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'claude-code-model',
              timestamp: new Date(0),
            },
            {
              type: 'tool-input-start',
              id: 'call-1',
              toolName: 'str_replace_editor',
              providerExecuted: true,
            },
            {
              type: 'tool-input-delta',
              id: 'call-1',
              delta: '{"command":"view","path":"/src/app.ts"}',
            },
            {
              type: 'tool-input-end',
              id: 'call-1',
            },
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'str_replace_editor',
              result: {
                content: '// app.ts content',
                line_count: 1,
              },
              providerExecuted: true,
            },
            {
              type: 'text-delta',
              id: 'text-1',
              delta: 'Done.',
            },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        }),
        tools: {},
        ...defaultSettings(),
      });

      const stream = result.fullStream;
      const chunks = await convertAsyncIterableToArray(stream);

      const toolResultChunk = chunks.find((c: any) => c.type === 'tool-result');
      expect(toolResultChunk).toBeDefined();
      expect((toolResultChunk as any)?.payload?.result).toEqual({
        content: '// app.ts content',
        line_count: 1,
      });
      expect((toolResultChunk as any)?.payload?.providerExecuted).toBe(true);

      const textChunks = chunks.filter((c: any) => c.type === 'text-delta');
      expect(textChunks.length).toBeGreaterThan(0);

      const finishChunk = chunks.find((c: any) => c.type === 'finish');
      expect(finishChunk).toBeDefined();
    });
  });

  describe('message part ordering should match stream order', () => {
    it('should persist tool-invocation parts between text parts when stream is text → tool-call → text', async () => {
      // Simulates a provider-executed tool (e.g. web_search) that arrives between two
      // text segments. The persisted message parts must reflect the actual stream order,
      // not batch all tool calls at the end.
      const messageList = createMessageListWithUserMessage();
      const result = loopFn({
        methodType: 'stream',
        runId,
        messageList,
        models: createTestModels({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            // First text segment
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Before the search.' },
            { type: 'text-end', id: 'text-1' },
            // Provider-executed tool call + result
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'web_search',
              input: '{ "query": "test" }',
              providerExecuted: true,
            },
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'web_search',
              result: { url: 'https://example.com', title: 'Example' },
              providerExecuted: true,
            },
            // Second text segment
            { type: 'text-start', id: 'text-2' },
            { type: 'text-delta', id: 'text-2', delta: 'After the search.' },
            { type: 'text-end', id: 'text-2' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          web_search: {
            type: 'provider-defined',
            id: 'test.web_search',
            name: 'web_search',
            inputSchema: z.object({ query: z.string() }),
            outputSchema: z.object({ url: z.string(), title: z.string() }),
            args: {},
          },
        },
        ...defaultSettings(),
      });

      await result.consumeStream();

      // Get the persisted assistant message parts
      const assistantMessages = messageList.get.all.db().filter(m => m.role === 'assistant');
      const parts = assistantMessages.flatMap(m => (m.content as any).parts ?? []);

      // Extract the types in order
      const partTypes = parts.map((p: any) =>
        p.type === 'tool-invocation' ? `tool:${p.toolInvocation.toolName}` : p.type,
      );

      // The tool invocation must appear between the two text parts, not at the end.
      // A 'step-start' part may appear when the provider tool result triggers a new loop step.
      const meaningful = partTypes.filter((t: string) => t !== 'step-start');
      expect(meaningful).toEqual(['text', 'tool:web_search', 'text']);
    });
  });

  describe('step-start between consecutive tool-only loop iterations', () => {
    it('should insert step-start between tool calls from different loop iterations', async () => {
      const messageList = createMessageListWithUserMessage();

      let responseCount = 0;
      const result = await loopFn({
        methodType: 'stream',
        runId,
        models: [
          {
            id: 'test-model',
            maxRetries: 0,
            model: new MockLanguageModelV2({
              doStream: async () => {
                switch (responseCount++) {
                  case 0:
                    // Iteration 1: tool call only
                    return {
                      stream: convertArrayToReadableStream([
                        {
                          type: 'response-metadata',
                          id: 'id-0',
                          modelId: 'mock-model-id',
                          timestamp: new Date(0),
                        },
                        {
                          type: 'tool-call',
                          id: 'call-1',
                          toolCallId: 'call-1',
                          toolName: 'weather',
                          input: '{ "city": "London" }',
                        },
                        {
                          type: 'finish',
                          finishReason: 'tool-calls',
                          usage: testUsage,
                        },
                      ]),
                    };
                  case 1:
                    // Iteration 2: another tool call only
                    return {
                      stream: convertArrayToReadableStream([
                        {
                          type: 'response-metadata',
                          id: 'id-1',
                          modelId: 'mock-model-id',
                          timestamp: new Date(100),
                        },
                        {
                          type: 'tool-call',
                          id: 'call-2',
                          toolCallId: 'call-2',
                          toolName: 'weather',
                          input: '{ "city": "Paris" }',
                        },
                        {
                          type: 'finish',
                          finishReason: 'tool-calls',
                          usage: testUsage,
                        },
                      ]),
                    };
                  case 2:
                    // Iteration 3: text response (ends the loop)
                    return {
                      stream: convertArrayToReadableStream([
                        {
                          type: 'response-metadata',
                          id: 'id-2',
                          modelId: 'mock-model-id',
                          timestamp: new Date(200),
                        },
                        { type: 'text-start', id: 'text-1' },
                        { type: 'text-delta', id: 'text-1', delta: 'Both cities are nice.' },
                        { type: 'text-end', id: 'text-1' },
                        {
                          type: 'finish',
                          finishReason: 'stop',
                          usage: testUsage,
                        },
                      ]),
                    };
                  default:
                    throw new Error(`Unexpected response count: ${responseCount}`);
                }
              },
            }),
          },
        ],
        tools: {
          weather: {
            inputSchema: z.object({ city: z.string() }),
            execute: async ({ city }: { city: string }) => ({
              city,
              temperature: 72,
            }),
          },
        },
        messageList,
        stopWhen: stepCountIs(4),
        ...defaultSettings(),
        _internal: {
          now: mockValues(0, 50, 100, 150, 200, 250, 300),
          generateId: mockId({ prefix: 'id' }),
        },
      });

      await result.consumeStream();

      // Get the single merged assistant message
      const assistantMessages = messageList.get.all.db().filter(m => m.role === 'assistant');
      const parts = assistantMessages.flatMap(m => m.content.parts ?? []);

      const partTypes = parts.map((p: any) =>
        p.type === 'tool-invocation' ? `tool:${p.toolInvocation.toolName}:${p.toolInvocation.toolCallId}` : p.type,
      );

      // There must be a step-start between the two tool calls from different iterations
      // Without the fix, consecutive tool-only turns would be merged without a boundary,
      // causing the LLM to see them as parallel calls from a single turn.
      const call1Idx = partTypes.findIndex((t: string) => t.includes('call-1'));
      const call2Idx = partTypes.findIndex((t: string) => t.includes('call-2'));
      expect(call1Idx).toBeGreaterThanOrEqual(0);
      expect(call2Idx).toBeGreaterThanOrEqual(0);
      expect(call2Idx).toBeGreaterThan(call1Idx);

      const stepStartsBetween = partTypes.slice(call1Idx + 1, call2Idx).filter((t: string) => t === 'step-start');
      expect(stepStartsBetween.length).toBeGreaterThanOrEqual(1);
    });
  });
}
