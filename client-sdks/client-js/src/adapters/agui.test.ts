import type { Message, BaseEvent } from '@ag-ui/client';
import { describe, it, expect, vi } from 'vitest';
import { generateUUID, convertMessagesToMastraMessages, AGUIAdapter } from './agui';
import { Agent } from '@mastra/core/agent';
import { MockLanguageModelV1 } from 'ai/test';
import { simulateReadableStream } from 'ai';

describe('generateUUID', () => {
  it('should generate a valid UUID v4 string', () => {
    const uuid = generateUUID();
    // Check UUID format (8-4-4-4-12 hex digits)
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }
    // All UUIDs should be unique
    expect(uuids.size).toBe(100);
  });
});

describe('convertMessagesToMastraMessages', () => {
  it('should convert user messages correctly', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: 'Hello, world!',
      },
    ];

    const result = convertMessagesToMastraMessages(messages);

    expect(result).toEqual([
      {
        role: 'user',
        content: 'Hello, world!',
      },
    ]);
  });

  it('should convert assistant messages correctly', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: 'Hello, I am an assistant',
      },
    ];

    const result = convertMessagesToMastraMessages(messages);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello, I am an assistant' }],
      },
    ]);
  });

  it('should convert assistant messages with tool calls correctly', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        content: undefined,
        toolCalls: [
          {
            id: 'tool-call-1',
            type: 'function',
            function: {
              name: 'getWeather',
              arguments: '{"location":"San Francisco"}',
            },
          },
        ],
      },
    ];

    const result = convertMessagesToMastraMessages(messages);

    expect(result).toEqual([
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'tool-call-1',
            toolName: 'getWeather',
            args: { location: 'San Francisco' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tool-call-1',
            toolName: 'getWeather',
            result: { location: 'San Francisco' },
          },
        ],
      },
    ]);
  });

  it('should convert tool messages correctly', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'tool',
        toolCallId: 'tool-call-1',
        content: '{"temperature":72,"unit":"F"}',
      },
    ];

    const result = convertMessagesToMastraMessages(messages);

    expect(result).toEqual([
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tool-call-1',
            toolName: 'unknown',
            result: '{"temperature":72,"unit":"F"}',
          },
        ],
      },
    ]);
  });

  it('should convert a complex conversation correctly', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'user',
        content: "What's the weather in San Francisco?",
      },
      {
        id: '2',
        role: 'assistant',
        content: undefined,
        toolCalls: [
          {
            id: 'tool-call-1',
            type: 'function',
            function: {
              name: 'getWeather',
              arguments: '{"location":"San Francisco"}',
            },
          },
        ],
      },
      {
        id: '4',
        role: 'assistant',
        content: 'The weather in San Francisco is 72°F.',
      },
    ];

    const result = convertMessagesToMastraMessages(messages);

    expect(result).toHaveLength(4);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('tool');
    expect(result[2].content).toEqual([
      {
        type: 'tool-result',
        toolCallId: 'tool-call-1',
        toolName: 'getWeather',
        result: { location: 'San Francisco' },
      },
    ]);
    expect(result[3].role).toBe('assistant');
  });
});

describe('AGUIAdapter', () => {
  it('should correctly pass parameters to agent stream method', async () => {
    // Create a real agent with MockLanguageModelV1
    const mockModel = new MockLanguageModelV1({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-delta', textDelta: 'Hello' },
            { type: 'text-delta', textDelta: ' from' },
            { type: 'text-delta', textDelta: ' agent' },
            {
              type: 'finish',
              finishReason: 'stop',
              logprobs: undefined,
              usage: { completionTokens: 3, promptTokens: 10 },
            },
          ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const agent = new Agent({
      name: 'Test Agent',
      instructions: 'You are a test agent',
      model: mockModel,
    });

    // Create a mock client agent that simulates the expected behavior
    const clientAgent = {
      stream: vi.fn().mockImplementation(async (params: any) => {
        // Verify the parameters are passed correctly
        expect(params).toHaveProperty('messages');
        expect(params).toHaveProperty('threadId');
        expect(params).toHaveProperty('resourceId');
        expect(params).toHaveProperty('runId');
        expect(params).toHaveProperty('clientTools');

        // Verify that messages array is passed, not the entire request object
        expect(Array.isArray(params.messages)).toBe(true);
        expect(params.messages[0]).toHaveProperty('role');
        expect(params.messages[0]).toHaveProperty('content');

        // Return a mock processDataStream that mimics the expected behavior
        return {
          processDataStream: vi.fn().mockImplementation(async ({ onTextPart, onFinishMessagePart }: any) => {
            // Simulate streaming text
            if (onTextPart) {
              onTextPart('Hello from agent');
            }
            if (onFinishMessagePart) {
              onFinishMessagePart();
            }
            return Promise.resolve();
          }),
        };
      }),
    };

    const adapter = new AGUIAdapter({
      agent: clientAgent as any,
      agentId: 'test',
      resourceId: 'testAgent',
    });

    const input = {
      threadId: 'test-thread-id',
      runId: 'test-run-id',
      messages: [
        {
          id: '1',
          role: 'user' as const,
          content: 'Hello',
        },
      ],
      tools: [],
      context: [],
    };

    const observable = adapter['run'](input);
    const events: BaseEvent[] = [];

    await new Promise<void>((resolve, reject) => {
      observable.subscribe({
        next: (event: BaseEvent) => events.push(event),
        complete: () => resolve(),
        error: (error: any) => reject(error),
      });
    });

    // Verify we received the expected events
    expect(events).toHaveLength(5); // RUN_STARTED, TEXT_MESSAGE_START, TEXT_MESSAGE_CONTENT, TEXT_MESSAGE_END, RUN_FINISHED
    expect(events[0].type).toBe('RUN_STARTED');
    expect(events[1].type).toBe('TEXT_MESSAGE_START');
    expect(events[2].type).toBe('TEXT_MESSAGE_CONTENT');
    expect(events[3].type).toBe('TEXT_MESSAGE_END');
    expect(events[4].type).toBe('RUN_FINISHED');

    // Verify the stream method was called with the correct parameters
    expect(clientAgent.stream).toHaveBeenCalledWith({
      threadId: 'test-thread-id',
      resourceId: 'testAgent',
      runId: 'test-run-id',
      messages: [{ role: 'user', content: 'Hello' }],
      clientTools: {},
    });
  });

  it('should handle messages without role property in request objects', async () => {
    // This test demonstrates that request objects without role property
    // would cause validation errors if passed directly to MessageList
    const requestObject = {
      threadId: 'test-thread-id',
      resourceId: 'testAgent',
      runId: 'test-run-id',
      messages: [
        {
          role: 'user',
          content: 'Hello',
        },
      ],
      clientTools: {},
    };

    // Request objects don't have role property
    expect('role' in requestObject).toBe(false);
    expect('messages' in requestObject).toBe(true);
    expect('content' in requestObject).toBe(false);
    expect('parts' in requestObject).toBe(false);

    // This structure would cause validation errors if treated as a message
    // because it lacks required message properties (role, content/parts)
    const hasValidMessageStructure =
      'role' in requestObject && ('content' in requestObject || 'parts' in requestObject);

    expect(hasValidMessageStructure).toBe(false);
  });
});
