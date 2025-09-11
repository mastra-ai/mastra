import type { WritableStream } from 'stream/web';
import type { ToolsInput } from '@mastra/core/agent';
import { RuntimeContext as RuntimeContextClass } from '@mastra/core/runtime-context';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { z } from 'zod';
import type { StreamVNextParams } from '../types';
import { zodToJsonSchema } from '../utils/zod-to-json-schema';
import { Agent } from './agent';

class TestAgent extends Agent {
  public lastProcessedParams: StreamVNextParams<any> | null = null;

  protected async processStreamResponse_vNext(
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
        apiKey: 'test-key',
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
