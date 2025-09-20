import type { WritableStream } from 'stream/web';
import type { ToolsInput } from '@mastra/core/agent';
import { RuntimeContext as RuntimeContextClass } from '@mastra/core/runtime-context';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { z } from 'zod';
import { MastraClient } from '../client';
import type { StreamVNextParams } from '../types';
import { zodToJsonSchema } from '../utils/zod-to-json-schema';
import { Agent } from './agent';

// Mock fetch globally
global.fetch = vi.fn();

class TestAgent extends Agent {
  public lastProcessedParams: StreamVNextParams<any> | null = null;

  public async processStreamResponse_vNext(
    params: StreamVNextParams<any>,
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

describe('Agent.streamVNext', () => {
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

  it('should transform params.output using zodToJsonSchema when provided', async () => {
    // Arrange: Create a sample Zod schema and params
    const outputSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const params: StreamVNextParams<typeof outputSchema> = {
      messages: [] as any,
      output: outputSchema,
    };

    // Act: Call streamVNext with the params
    await agent.streamVNext(params);

    // Assert: Verify output schema transformation
    const expectedSchema = zodToJsonSchema(outputSchema);
    expect(agent.lastProcessedParams?.output).toEqual(expectedSchema);
  });

  it('should set processedParams.output to undefined when params.output is not provided', async () => {
    // Arrange: Create params without output schema
    const params: StreamVNextParams<undefined> = {
      messages: [] as any,
    };

    // Act: Call streamVNext with the params
    await agent.streamVNext(params);

    // Assert: Verify output is undefined
    expect(agent.lastProcessedParams?.output).toBeUndefined();
  });

  it('should process runtimeContext through parseClientRuntimeContext', async () => {
    // Arrange: Create a RuntimeContext-like instance with test data
    const contextData = new Map([
      ['env', 'test'],
      ['userId', '123'],
    ]);

    const runtimeContext: any = {
      entries: () => contextData,
    };
    // Ensure instanceof RuntimeContext succeeds so parseClientRuntimeContext converts it
    Object.setPrototypeOf(runtimeContext, RuntimeContextClass.prototype);

    const params: StreamVNextParams<undefined> = {
      messages: [] as any,
      runtimeContext,
    };

    // Act: Call streamVNext with the params
    await agent.streamVNext(params);

    // Assert: Verify runtimeContext was converted to plain object
    expect(agent.lastProcessedParams?.runtimeContext).toEqual({
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

    const params: StreamVNextParams<undefined> = {
      messages: [] as any,
      clientTools,
    };

    // Act: Call streamVNext with the params
    await agent.streamVNext(params);

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
    const params: StreamVNextParams<undefined> = {
      messages: [],
    };

    // Act: Call streamVNext
    const response = await agent.streamVNext(params);

    // Assert: Verify response structure
    expect(response).toBeInstanceOf(Response);
    expect(response.processDataStream).toBeInstanceOf(Function);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/event-stream');
  });

  it('should invoke onChunk callback when processing stream data', async () => {
    // Arrange: Create callback and params
    const onChunk = vi.fn();
    const params: StreamVNextParams<undefined> = {
      messages: [],
    };

    // Act: Process the stream
    const response = await agent.streamVNext(params);
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
    const result = await client.getAgents();
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });

  it('should get all agents with runtimeContext', async () => {
    const mockResponse = {
      agent1: { name: 'Agent 1', model: 'gpt-4' },
      agent2: { name: 'Agent 2', model: 'gpt-3.5' },
    };
    const runtimeContext = { userId: '123', sessionId: 'abc' };
    const expectedBase64 = btoa(JSON.stringify(runtimeContext));
    const expectedEncodedBase64 = encodeURIComponent(expectedBase64);

    mockFetchResponse(mockResponse);
    const result = await client.getAgents(runtimeContext);
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      `${clientOptions.baseUrl}/api/agents?runtimeContext=${expectedEncodedBase64}`,
      expect.objectContaining({
        headers: expect.objectContaining(clientOptions.headers),
      }),
    );
  });
});
