import type { WritableStream } from 'stream/web';
import type { ToolsInput } from '@mastra/core/agent';
import { RequestContext as RequestContextClass } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { z } from 'zod';
import { MastraClient } from '../client';
import type { StreamParams, ClientOptions } from '../types';
import { zodToJsonSchema } from '../utils/zod-to-json-schema';
import { Agent } from './agent';

// Mock fetch globally
global.fetch = vi.fn();

class TestAgent extends Agent {
  public lastProcessedParams: StreamParams<any> | null = null;

  public async processStreamResponse(
    params: StreamParams<any>,
    writable: WritableStream<Uint8Array>,
  ): Promise<Response> {
    this.lastProcessedParams = params;
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    // Write SSE-formatted data with valid JSON so that processMastraStream can parse it and invoke onChunk
    void writer.write(encoder.encode('data: "test"\n\n')).then(() => {
      return writer.close();
    });
    return new Response(null, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }
}

describe('Agent.stream', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent(
      {
        baseUrl: 'https://test.com',
        headers: {
          Authorization: 'Bearer test-key',
        },
      },
      'test-agent',
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should transform params.structuredOutput.schema using zodToJsonSchema when provided', async () => {
    const outputSchema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const jsonSchema = zodToJsonSchema(outputSchema);
    const params: StreamParams<typeof outputSchema> = {
      messages: [] as any,
      structuredOutput: { schema: outputSchema },
    };
    await agent.stream(params);
    expect(agent.lastProcessedParams?.structuredOutput).toEqual({ schema: jsonSchema });
  });

  it('should process requestContext through parseClientRequestContext', async () => {
    // Arrange: Create a RequestContext-like instance with test data
    const contextData = new Map([
      ['env', 'test'],
      ['userId', '123'],
    ]);

    const requestContext: any = {
      entries: () => contextData,
    };
    // Ensure instanceof RequestContext succeeds so parseClientRequestContext converts it
    Object.setPrototypeOf(requestContext, RequestContextClass.prototype);

    const params: StreamParams<undefined> = {
      messages: [] as any,
      requestContext,
    };

    // Act: Call stream with the params
    await agent.stream(params);

    // Assert: Verify requestContext was converted to plain object
    expect(agent.lastProcessedParams?.requestContext).toEqual({
      env: 'test',
      userId: '123',
    });
  });

  it('should process clientTools through processClientTools', async () => {
    // Arrange: Create test tools with Zod schemas
    const inputSchema = z.object({
      query: z.string(),
    });
    const outputSchema = z.object({
      results: z.array(z.string()),
    });

    const clientTools: ToolsInput = {
      search: {
        name: 'search',
        description: 'Search for items',
        inputSchema,
        outputSchema,
      },
    };

    const params: StreamParams<undefined> = {
      messages: [] as any,
      clientTools,
    };

    // Act: Call stream with the params
    await agent.stream(params);

    // Assert: Verify schemas were converted while preserving other properties
    expect(agent.lastProcessedParams?.clientTools).toEqual({
      search: {
        name: 'search',
        description: 'Search for items',
        inputSchema: zodToJsonSchema(inputSchema),
        outputSchema: zodToJsonSchema(outputSchema),
      },
    });
  });

  it('should return a Response object with processDataStream method', async () => {
    // Arrange: Create minimal params
    const params: StreamParams<undefined> = {
      messages: [],
    };

    // Act: Call stream
    const response = await agent.stream(params);

    // Assert: Verify response structure
    expect(response).toBeInstanceOf(Response);
    expect(response.processDataStream).toBeInstanceOf(Function);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
  });

  it('should invoke onChunk callback when processing stream data', async () => {
    // Arrange: Create callback and params
    const onChunk = vi.fn();
    const params: StreamParams<undefined> = {
      messages: [],
    };

    // Act: Process the stream
    const response = await agent.stream(params);
    await response.processDataStream({ onChunk });

    // Assert: Verify callback execution
    expect(onChunk).toHaveBeenCalled();
    const firstCall = onChunk.mock.calls[0];
    expect(firstCall[0]).toBeDefined();
    expect(typeof firstCall[0]).toBe('string');
    expect(firstCall[0]).toBe('test');
  });
});

describe('Agent Voice Resource', () => {
  let client: MastraClient;
  let agent: ReturnType<typeof client.getAgent>;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  // Helper to mock successful API responses
  const mockFetchResponse = (data: any, options: { isStream?: boolean } = {}) => {
    if (options.isStream) {
      let contentType = 'text/event-stream';
      let responseBody: ReadableStream;

      if (data instanceof ReadableStream) {
        responseBody = data;
        contentType = 'audio/mp3';
      } else {
        responseBody = new ReadableStream({
          start(controller) {
            if (typeof data === 'string') {
              controller.enqueue(new TextEncoder().encode(data));
            } else if (typeof data === 'object' && data !== null) {
              controller.enqueue(new TextEncoder().encode(JSON.stringify(data)));
            } else {
              controller.enqueue(new TextEncoder().encode(String(data)));
            }
            controller.close();
          },
        });
      }

      const headers = new Headers();
      if (contentType === 'audio/mp3') {
        headers.set('Transfer-Encoding', 'chunked');
      }
      headers.set('Content-Type', contentType);

      (global.fetch as any).mockResolvedValueOnce(
        new Response(responseBody, {
          status: 200,
          statusText: 'OK',
          headers,
        }),
      );
    } else {
      const response = new Response(undefined, {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      });
      response.json = () => Promise.resolve(data);
      (global.fetch as any).mockResolvedValueOnce(response);
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
    agent = client.getAgent('test-agent');
  });

  it('should get available speakers', async () => {
    const mockResponse = [{ voiceId: 'speaker1' }];
    mockFetchResponse(mockResponse);

    const result = await agent.voice.getSpeakers();

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents/test-agent/voice/speakers`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it(`should call speak without options`, async () => {
    const mockAudioStream = new ReadableStream();
    mockFetchResponse(mockAudioStream, { isStream: true });

    const result = await agent.voice.speak('test');

    expect(result).toBeInstanceOf(Response);
    expect(result.body).toBeInstanceOf(ReadableStream);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents/test-agent/voice/speak`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it(`should call speak with options`, async () => {
    const mockAudioStream = new ReadableStream();
    mockFetchResponse(mockAudioStream, { isStream: true });

    const result = await agent.voice.speak('test', { speaker: 'speaker1' });
    expect(result).toBeInstanceOf(Response);
    expect(result.body).toBeInstanceOf(ReadableStream);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents/test-agent/voice/speak`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it(`should call listen with audio file`, async () => {
    const transcriptionResponse = { text: 'Hello world' };
    mockFetchResponse(transcriptionResponse);

    const audioBlob = new Blob(['test audio data'], { type: 'audio/wav' });

    const result = await agent.voice.listen(audioBlob, { filetype: 'wav' });
    expect(result).toEqual(transcriptionResponse);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, config] = (global.fetch as any).mock.calls[0];
    expect(url).toBe(`${clientOptions.baseUrl}/api/agents/test-agent/voice/listen`);
    expect(config.method).toBe('POST');
    expect(config.headers).toMatchObject(clientOptions.headers);

    const formData = config.body;
    expect(formData).toBeInstanceOf(FormData);
    const audioContent = formData.get('audio');
    expect(audioContent).toBeInstanceOf(Blob);
    expect(audioContent.type).toBe('audio/wav');
  });

  it(`should call listen with audio blob and options`, async () => {
    const transcriptionResponse = { text: 'Hello world' };
    mockFetchResponse(transcriptionResponse);

    const audioBlob = new Blob(['test audio data'], { type: 'audio/mp3' });

    const result = await agent.voice.listen(audioBlob, { filetype: 'mp3' });

    expect(result).toEqual(transcriptionResponse);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, config] = (global.fetch as any).mock.calls[0];
    expect(url).toBe(`${clientOptions.baseUrl}/api/agents/test-agent/voice/listen`);
    expect(config.method).toBe('POST');
    expect(config.headers).toMatchObject(clientOptions.headers);

    const formData = config.body as FormData;
    expect(formData).toBeInstanceOf(FormData);
    const audioContent = formData.get('audio');
    expect(audioContent).toBeInstanceOf(Blob);
    expect(formData.get('options')).toBe(JSON.stringify({ filetype: 'mp3' }));
  });
});

describe('Agent Client Methods', () => {
  let client: MastraClient;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  // Helper to mock successful API responses
  const mockFetchResponse = (data: any, options: { isStream?: boolean } = {}) => {
    if (options.isStream) {
      let contentType = 'text/event-stream';
      let responseBody: ReadableStream;

      if (data instanceof ReadableStream) {
        responseBody = data;
        contentType = 'audio/mp3';
      } else {
        responseBody = new ReadableStream({
          start(controller) {
            if (typeof data === 'string') {
              controller.enqueue(new TextEncoder().encode(data));
            } else if (typeof data === 'object' && data !== null) {
              controller.enqueue(new TextEncoder().encode(JSON.stringify(data)));
            } else {
              controller.enqueue(new TextEncoder().encode(String(data)));
            }
            controller.close();
          },
        });
      }

      const headers = new Headers();
      if (contentType === 'audio/mp3') {
        headers.set('Transfer-Encoding', 'chunked');
      }
      headers.set('Content-Type', contentType);

      (global.fetch as any).mockResolvedValueOnce(
        new Response(responseBody, {
          status: 200,
          statusText: 'OK',
          headers,
        }),
      );
    } else {
      const response = new Response(undefined, {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      });
      response.json = () => Promise.resolve(data);
      (global.fetch as any).mockResolvedValueOnce(response);
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  it('should get all agents', async () => {
    const mockResponse = {
      agent1: { name: 'Agent 1', model: 'gpt-4' },
      agent2: { name: 'Agent 2', model: 'gpt-3.5' },
    };
    mockFetchResponse(mockResponse);
    const result = await client.listAgents();
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should get all agents with requestContext', async () => {
    const mockResponse = {
      agent1: { name: 'Agent 1', model: 'gpt-4' },
      agent2: { name: 'Agent 2', model: 'gpt-3.5' },
    };
    const requestContext = { userId: '123', sessionId: 'abc' };
    const expectedBase64 = btoa(JSON.stringify(requestContext));
    const expectedEncodedBase64 = encodeURIComponent(expectedBase64);

    mockFetchResponse(mockResponse);
    const result = await client.listAgents(requestContext);
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents?requestContext=${expectedEncodedBase64}`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });
});

describe('Agent - Storage Duplicate Messages Issue', () => {
  let agent: Agent;
  let mockRequest: ReturnType<typeof vi.fn>;

  const mockClientOptions: ClientOptions = {
    baseUrl: 'https://api.test.com',
  };

  beforeEach(() => {
    mockRequest = vi.fn();
    agent = new Agent(mockClientOptions, 'test-agent-id');
    // Replace the request method with our mock
    agent['request'] = mockRequest;
  });

  it('should not re-send the original user message when executing client-side tools', async () => {
    const clientTool = createTool({
      id: 'clientTool',
      description: 'A client-side tool',
      execute: vi.fn().mockResolvedValue('Tool result'),
      inputSchema: undefined,
    });

    const initialMessage = 'Test message';

    // First call returns tool-calls
    mockRequest.mockResolvedValueOnce({
      finishReason: 'tool-calls',
      toolCalls: [
        {
          toolName: 'clientTool',
          args: { test: 'args' },
          toolCallId: 'tool-1',
        },
      ],
      response: {
        messages: [
          {
            role: 'assistant',
            content: '',
            toolCalls: [
              {
                toolName: 'clientTool',
                args: { test: 'args' },
                toolCallId: 'tool-1',
              },
            ],
          },
        ],
      },
    });

    // Second call (after tool execution) returns final response
    mockRequest.mockResolvedValueOnce({
      finishReason: 'stop',
      response: {
        messages: [
          {
            role: 'assistant',
            content: 'Final response',
          },
        ],
      },
    });

    await agent.generate(initialMessage, {
      clientTools: { clientTool },
    });

    // Check that the second request was called with the correct messages
    expect(mockRequest).toHaveBeenCalledTimes(2);
    const secondCallArgs = mockRequest.mock.calls[1][1];
    const messagesInSecondCall = secondCallArgs.body.messages;

    // The messages sent in the second call should NOT include the original user message
    // It should only have the assistant's tool call response and the tool result
    // This prevents duplicate user messages from being stored
    const userMessages = messagesInSecondCall.filter(msg => msg.role === 'user');

    // Should be no user messages in the second call
    expect(userMessages).toHaveLength(0);

    // Should have assistant message with tool call and tool result
    expect(messagesInSecondCall).toHaveLength(2);
    expect(messagesInSecondCall[0].role).toBe('assistant');
    expect(messagesInSecondCall[1].role).toBe('tool');
  });

  it('should handle multiple tool calls without duplicating the user message', async () => {
    const clientTool = createTool({
      id: 'clientTool',
      description: 'A client-side tool',
      execute: vi
        .fn()
        .mockResolvedValueOnce('First result')
        .mockResolvedValueOnce('Second result')
        .mockResolvedValueOnce('Third result')
        .mockResolvedValueOnce('Fourth result'),
      inputSchema: undefined,
    });

    const initialMessage = 'Test message that triggers 4 tool calls';

    // Simulate 4 tool call iterations
    for (let i = 0; i < 4; i++) {
      mockRequest.mockResolvedValueOnce({
        finishReason: 'tool-calls',
        toolCalls: [
          {
            toolName: 'clientTool',
            args: { iteration: i + 1 },
            toolCallId: `tool-${i + 1}`,
          },
        ],
        response: {
          messages: [
            {
              role: 'assistant',
              content: '',
              toolCalls: [
                {
                  toolName: 'clientTool',
                  args: { iteration: i + 1 },
                  toolCallId: `tool-${i + 1}`,
                },
              ],
            },
          ],
        },
      });
    }

    // Final response after 4 tool calls
    mockRequest.mockResolvedValueOnce({
      finishReason: 'stop',
      response: {
        messages: [
          {
            role: 'assistant',
            content: 'Final response after 4 tool calls',
          },
        ],
      },
    });

    await agent.generate(initialMessage, {
      clientTools: { clientTool },
    });

    // The agent should have made 5 requests total (1 initial + 4 tool calls)
    expect(mockRequest).toHaveBeenCalledTimes(5);

    // Check each recursive call to ensure no user messages are being re-sent
    for (let i = 1; i < 5; i++) {
      const callArgs = mockRequest.mock.calls[i][1];
      const messagesInCall = callArgs.body.messages;

      const userMessages = messagesInCall.filter(msg => msg.role === 'user');

      // No user messages should be in any of the recursive calls
      expect(userMessages).toHaveLength(0);

      // Each recursive call should only contain the latest assistant response and tool result
      // Not the accumulated history (that's already on the server)
      const assistantMessages = messagesInCall.filter(msg => msg.role === 'assistant');
      const toolMessages = messagesInCall.filter(msg => msg.role === 'tool');

      // Should always have just the last assistant message and the new tool result
      expect(assistantMessages).toHaveLength(1);
      expect(toolMessages).toHaveLength(1);
    }
  });
});
