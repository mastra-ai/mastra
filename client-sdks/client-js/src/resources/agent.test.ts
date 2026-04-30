import { formatDataStreamPart, processDataStream } from '@ai-sdk/ui-utils';
import { createTool } from '@mastra/core/tools';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v3';

import { MastraClient } from '../client';
import type { ClientOptions } from '../types';
import { processClientTools } from '../utils/process-client-tools';
import { zodToJsonSchema } from '../utils/zod-to-json-schema';
import { Agent } from './agent';

class TestAgent extends Agent {
  override async processStreamResponse(
    processedParams: any,
    _controller: ReadableStreamDefaultController<Uint8Array>,
    route: string = 'stream',
  ): Promise<Response> {
    return (this['request'] as typeof this.request)(`/agents/test-agent/${route}`, {
      method: 'POST',
      body: processedParams,
      stream: true,
    }) as Promise<Response>;
  }
}

describe('Agent.stream', () => {
  const mockClientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should transform params.structuredOutput.schema using zodToJsonSchema when provided', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    const schema = z.object({ name: z.string() });
    const params = {
      messages: 'test message',
      structuredOutput: {
        schema,
      },
    };

    await agent.stream(params.messages, params);

    const requestBody = mockRequest.mock.calls[0][1].body;
    expect(requestBody.structuredOutput.schema).toEqual(zodToJsonSchema(schema));
  });

  it('should process requestContext through parseClientRequestContext', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    const requestContext = { userId: 'user-123' } as any;
    const params = {
      messages: 'test message',
      requestContext,
    };

    await agent.stream(params.messages, params);

    const requestBody = mockRequest.mock.calls[0][1].body;
    expect(requestBody.requestContext).toEqual({ userId: 'user-123' });
  });

  it('should process clientTools through processClientTools', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    const clientTools = {
      testTool: {
        id: 'testTool',
        description: 'A test tool',
        inputSchema: z.object({ input: z.string() }),
        execute: vi.fn(),
      },
    };

    const params = {
      messages: 'test message',
      clientTools,
    };

    await agent.stream(params.messages, params);

    const requestBody = mockRequest.mock.calls[0][1].body;
    expect(requestBody.clientTools).toEqual(processClientTools(clientTools));
  });
});

describe('Agent.streamUntilIdle', () => {
  const mockClientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should transform params.structuredOutput.schema using zodToJsonSchema when provided', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    const schema = z.object({ name: z.string() });
    const params = {
      messages: 'test message',
      structuredOutput: {
        schema,
      },
    };

    await agent.streamUntilIdle(params.messages, params);

    const requestBody = mockRequest.mock.calls[0][1].body;
    expect(requestBody.structuredOutput.schema).toEqual(zodToJsonSchema(schema));
  });

  it('should process requestContext through parseClientRequestContext', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    const requestContext = { userId: 'user-123' } as any;
    const params = {
      messages: 'test message',
      requestContext,
    };

    await agent.streamUntilIdle(params.messages, params);

    const requestBody = mockRequest.mock.calls[0][1].body;
    expect(requestBody.requestContext).toEqual({ userId: 'user-123' });
  });

  it('should process clientTools through processClientTools', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    const clientTools = {
      testTool: {
        id: 'testTool',
        description: 'A test tool',
        inputSchema: z.object({ input: z.string() }),
        execute: vi.fn(),
      },
    };

    const params = {
      messages: 'test message',
      clientTools,
    };

    await agent.streamUntilIdle(params.messages, params);

    const requestBody = mockRequest.mock.calls[0][1].body;
    expect(requestBody.clientTools).toEqual(processClientTools(clientTools));
  });

  it('should post to the /stream-until-idle route', async () => {
    const agent = new TestAgent(mockClientOptions, 'test-agent');
    const mockRequest = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
    agent['request'] = mockRequest as (typeof agent)['request'];

    await agent.streamUntilIdle('test message');

    const [url] = mockRequest.mock.calls[0];
    expect(url).toBe('/agents/test-agent/stream-until-idle');
  });
});

describe('Agent Voice Resource', () => {
  let client: MastraClient;
  let agent: Agent;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

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

  it('should create an agent with version options', async () => {
    const versionedAgent = client.getAgent('test-agent', { versionId: 'version-123' });

    expect(versionedAgent).toBeInstanceOf(Agent);
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

  it('should include versionId when getting speakers', async () => {
    const versionedAgent = client.getAgent('test-agent', { versionId: 'version-123' });
    const mockResponse = [{ voiceId: 'speaker1' }];
    mockFetchResponse(mockResponse);

    await versionedAgent.voice.getSpeakers();

    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents/test-agent/voice/speakers?versionId=version-123`,
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
  let agent: Agent;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

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

  it('should get agents summary', async () => {
    const mockResponse = {
      agent1: { id: 'agent1', name: 'Agent 1', description: 'first' },
      agent2: { id: 'agent2', name: 'Agent 2' },
    };
    mockFetchResponse(mockResponse);
    const result = await client.listAgentsSummary();
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents/summary`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should get agent details', async () => {
    const mockResponse = { id: 'test-agent', name: 'Test Agent', instructions: 'Be helpful' };
    mockFetchResponse(mockResponse);

    const result = await agent.details();

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents/test-agent`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should list override versions for a code agent', async () => {
    const mockResponse = {
      versions: [{ id: 'version-1', agentId: 'test-agent', versionNumber: 1 }],
      page: 0,
      perPage: 10,
      hasMore: false,
    };
    mockFetchResponse(mockResponse);

    const result = await agent.listVersions({
      page: 0,
      perPage: 10,
      orderBy: 'createdAt',
      sortDirection: 'DESC',
    });

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions?page=0&perPage=10&orderBy=createdAt&sortDirection=DESC`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should create an override version for a code agent', async () => {
    const createParams = {
      instructions: 'Updated instructions',
      tools: { weather: { enabled: true, description: 'Weather tool' } },
      changeMessage: 'Update override config',
    };
    const mockResponse = {
      id: 'version-new',
      agentId: 'test-agent',
      versionNumber: 2,
      instructions: createParams.instructions,
      tools: createParams.tools,
      changeMessage: createParams.changeMessage,
      createdAt: '2024-01-02T00:00:00.000Z',
    };
    mockFetchResponse(mockResponse);

    const result = await agent.createVersion(createParams);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(createParams),
        headers: expect.objectContaining({
          'content-type': 'application/json',
        }),
      }),
    );
  });

  it('should create an override version without params', async () => {
    const mockResponse = {
      id: 'version-auto',
      agentId: 'test-agent',
      versionNumber: 3,
      createdAt: '2024-01-03T00:00:00.000Z',
    };
    mockFetchResponse(mockResponse);

    const result = await agent.createVersion();

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );
  });

  it('should get a specific override version for a code agent', async () => {
    const versionId = 'version-1';
    const mockResponse = {
      id: versionId,
      agentId: 'test-agent',
      versionNumber: 1,
      instructions: 'You are a helpful assistant',
      changedFields: ['instructions'],
      changeMessage: 'Updated instructions',
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    mockFetchResponse(mockResponse);

    const result = await agent.getVersion(versionId);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions/${versionId}`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should activate an override version for a code agent', async () => {
    const versionId = 'version-1';
    const mockResponse = {
      success: true,
      message: 'Version 1 is now active',
      activeVersionId: versionId,
    };
    mockFetchResponse(mockResponse);

    const result = await agent.activateVersion(versionId);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions/${versionId}/activate`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should restore an override version for a code agent', async () => {
    const versionId = 'version-1';
    const mockResponse = {
      id: 'version-new',
      agentId: 'test-agent',
      versionNumber: 4,
      instructions: 'You are a helpful assistant',
      changedFields: ['instructions'],
      changeMessage: 'Restored from version 1',
      createdAt: '2024-01-04T00:00:00.000Z',
    };
    mockFetchResponse(mockResponse);

    const result = await agent.restoreVersion(versionId);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions/${versionId}/restore`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should delete an override version for a code agent', async () => {
    const versionId = 'version-1';
    const mockResponse = {
      success: true,
      message: 'Version deleted successfully',
    };
    mockFetchResponse(mockResponse);

    const result = await agent.deleteVersion(versionId);

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions/${versionId}`,
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should compare override versions for a code agent', async () => {
    const mockResponse = {
      diffs: [
        {
          field: 'instructions',
          oldValue: 'Old instructions',
          newValue: 'New instructions',
        },
      ],
    };
    mockFetchResponse(mockResponse);

    const result = await agent.compareVersions('version-1', 'version-2');

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/stored/agents/test-agent/versions/compare?from=version-1&to=version-2`,
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
    agent['request'] = mockRequest as (typeof agent)['request'];
  });

  it('should not re-send the original user message when executing client-side tools', async () => {
    const clientTool = createTool({
      id: 'clientTool',
      description: 'A client-side tool',
      execute: vi.fn().mockResolvedValue('Tool result'),
      inputSchema: undefined,
    });

    const initialMessage = 'Test message';

    mockRequest.mockResolvedValueOnce({
      finishReason: 'tool-calls',
      toolCalls: [
        {
          payload: {
            toolName: 'clientTool',
            args: { test: 'args' },
            toolCallId: 'tool-1',
          },
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
      memory: { thread: 'test-thread-123', resource: 'test-resource-123' },
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    const secondCallArgs = mockRequest.mock.calls[1][1];
    const messagesInSecondCall = secondCallArgs.body.messages;

    const userMessages = messagesInSecondCall.filter((msg: any) => msg.role === 'user');

    expect(userMessages).toHaveLength(0);
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

    const initialMessage = 'Test message that triggers multiple tools';

    mockRequest.mockResolvedValueOnce({
      finishReason: 'tool-calls',
      toolCalls: [
        {
          payload: {
            toolName: 'clientTool',
            args: { iteration: 1 },
            toolCallId: 'tool-1',
          },
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
                args: { iteration: 1 },
                toolCallId: 'tool-1',
              },
            ],
          },
        ],
      },
    });

    mockRequest.mockResolvedValueOnce({
      finishReason: 'tool-calls',
      toolCalls: [
        {
          payload: {
            toolName: 'clientTool',
            args: { iteration: 2 },
            toolCallId: 'tool-2',
          },
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
                args: { iteration: 2 },
                toolCallId: 'tool-2',
              },
            ],
          },
        ],
      },
    });

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
      memory: { thread: 'test-thread-123', resource: 'test-resource-123' },
    });

    expect(mockRequest).toHaveBeenCalledTimes(3);

    const secondCallMessages = mockRequest.mock.calls[1][1].body.messages;
    const thirdCallMessages = mockRequest.mock.calls[2][1].body.messages;

    expect(secondCallMessages.filter((msg: any) => msg.role === 'user')).toHaveLength(0);
    expect(thirdCallMessages.filter((msg: any) => msg.role === 'user')).toHaveLength(0);
  });
});

describe('streaming behavior', () => {
  it('should parse data stream chunks', async () => {
    const chunks: any[] = [];
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(formatDataStreamPart('data', [{ type: 'text-delta', textDelta: 'hello' }])),
        );
        controller.close();
      },
    });

    await processDataStream({
      stream,
      onDataPart: chunk => {
        chunks.push(chunk);
      },
    });

    expect(chunks).toHaveLength(1);
  });
});
