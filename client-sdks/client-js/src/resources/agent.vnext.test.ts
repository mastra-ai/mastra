import { getErrorFromUnknown } from '@mastra/core/error';
import { createTool } from '@mastra/core/tools';
import { APICallError } from 'ai-v5';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import z from 'zod';
import { MastraClient } from '../client';

// Mock fetch globally
global.fetch = vi.fn();

// Helper to build a ReadableStream of SSE data chunks
function sseResponse(chunks: Array<object | string>, { status = 200 }: { status?: number } = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        if (typeof chunk === 'string') {
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
        } else {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
      }
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });
  return new Response(stream as unknown as ReadableStream, {
    status,
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('Agent vNext', () => {
  const client = new MastraClient({ baseUrl: 'http://localhost:4111', headers: { Authorization: 'Bearer test-key' } });
  const agent = client.getAgent('agent-1');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stream: completes when server sends finish without tool calls', async () => {
    // step-start -> text-delta -> step-finish -> finish: stop
    const sseChunks = [
      { type: 'step-start', payload: { messageId: 'm1' } },
      { type: 'text-delta', payload: { text: 'Hello' } },
      { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
      { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 1 } } },
    ];

    (global.fetch as any).mockResolvedValueOnce(sseResponse(sseChunks));

    const resp = await agent.stream({ messages: 'hi' });

    // Verify stream can be consumed without errors
    let receivedChunks = 0;
    await resp.processDataStream({
      onChunk: async _chunk => {
        receivedChunks++;
      },
    });
    expect(receivedChunks).toBe(4); // Should receive all chunks from sseChunks array

    // Verify request
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/agents/agent-1/stream',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('stream: executes client tool and triggers recursive call on finish reason tool-calls', async () => {
    // This test also verifies issue #8302 is fixed (WritableStream locked error)
    // The error could occur at two locations during recursive stream calls:
    // 1. writable.getWriter() during recursive pipe operation
    // 2. writable.close() in setTimeout after stream finishes
    // Both errors stem from the same race condition where the writable stream
    // is locked by pipeTo() when code tries to access it.
    const toolCallId = 'call_1';

    // First cycle: emit tool-call and finish with tool-calls
    const firstCycle = [
      { type: 'step-start', payload: { messageId: 'm1' } },
      {
        type: 'tool-call',
        payload: { toolCallId, toolName: 'weatherTool', args: { location: 'NYC' } },
      },
      { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
      { type: 'finish', payload: { stepResult: { reason: 'tool-calls' }, usage: { totalTokens: 2 } } },
    ];

    // Second cycle: emit normal completion after tool result handling
    const secondCycle = [
      { type: 'step-start', payload: { messageId: 'm2' } },
      { type: 'text-delta', payload: { text: 'Tool handled' } },
      { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
      { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 3 } } },
    ];

    // Mock two sequential fetch calls (initial and recursive)
    (global.fetch as any)
      .mockResolvedValueOnce(sseResponse(firstCycle))
      .mockResolvedValueOnce(sseResponse(secondCycle));

    const executeSpy = vi.fn(async () => ({ ok: true }));
    const weatherTool = createTool({
      id: 'weatherTool',
      description: 'Weather',
      inputSchema: z.object({ location: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
      execute: executeSpy,
    });

    const resp = await agent.stream({ messages: 'weather?', clientTools: { weatherTool } });

    let lastChunk = null;
    await resp.processDataStream({
      onChunk: async chunk => {
        lastChunk = chunk;
      },
    });

    expect(lastChunk?.type).toBe('finish');
    expect(lastChunk?.payload?.stepResult?.reason).toBe('stop');
    // Client tool executed
    expect(executeSpy).toHaveBeenCalledTimes(1);
    // Recursive request made
    expect((global.fetch as any).mock.calls.filter((c: any[]) => (c?.[0] as string).includes('/stream')).length).toBe(
      2,
    );
  });

  it('stream: step execution when client tool is present without an execute function', async () => {
    const toolCallId = 'call_1';

    // First cycle: emit tool-call and finish with tool-calls
    const firstCycle = [
      { type: 'step-start', payload: { messageId: 'm1' } },
      {
        type: 'tool-call',
        payload: { toolCallId, toolName: 'weatherTool', args: { location: 'NYC' } },
      },
      { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
      { type: 'finish', payload: { stepResult: { reason: 'tool-calls' }, usage: { totalTokens: 2 } } },
    ];

    // Second cycle: emit normal completion after tool result handling
    const secondCycle = [
      { type: 'step-start', payload: { messageId: 'm2' } },
      { type: 'text-delta', payload: { text: 'Tool handled' } },
      { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
      { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 3 } } },
    ];

    // Mock two sequential fetch calls (initial and recursive)
    (global.fetch as any)
      .mockResolvedValueOnce(sseResponse(firstCycle))
      .mockResolvedValueOnce(sseResponse(secondCycle));

    const weatherTool = createTool({
      id: 'weatherTool',
      description: 'Weather',
      inputSchema: z.object({ location: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
    });

    const resp = await agent.stream({ messages: 'weather?', clientTools: { weatherTool } });

    let lastChunk = null;
    await resp.processDataStream({
      onChunk: async chunk => {
        lastChunk = chunk;
      },
    });

    expect(lastChunk?.type).toBe('finish');
    expect(lastChunk?.payload?.stepResult?.reason).toBe('tool-calls');

    // Recursive request made
    expect((global.fetch as any).mock.calls.filter((c: any[]) => (c?.[0] as string).includes('/stream')).length).toBe(
      1,
    );
  });

  it('generate: returns JSON using mocked fetch', async () => {
    const mockJson = { id: 'gen-1', text: 'ok' };
    (global.fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify(mockJson), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const result = await agent.generate('hello');
    expect(result).toEqual(mockJson);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/agents/agent-1/generate',
      expect.objectContaining({
        body: '{"messages":"hello"}',
        credentials: undefined,
        headers: {
          Authorization: 'Bearer test-key',
          'content-type': 'application/json',
        },
        method: 'POST',
        signal: undefined,
      }),
    );
  });

  it('stream: supports structuredOutput without explicit model', async () => {
    // Mock response with structured output
    const sseChunks = [
      { type: 'step-start', payload: { messageId: 'm1' } },
      { type: 'text-delta', payload: { text: '{"name": "John", "age": 30}' } },
      { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
      { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 1 } } },
    ];

    (global.fetch as any).mockResolvedValueOnce(sseResponse(sseChunks));

    // Define a schema for structured output
    const personSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const resp = await agent.stream({
      messages: 'Create a person object',
      structuredOutput: {
        schema: personSchema,
        // Note: No model provided - should fallback to agent's model
      },
    });

    // Verify stream works correctly
    let receivedChunks = 0;
    await resp.processDataStream({
      onChunk: async _chunk => {
        receivedChunks++;
      },
    });
    expect(receivedChunks).toBe(4);

    // Verify request contains structuredOutput in the body
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/agents/agent-1/stream',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringMatching(/structuredOutput/),
      }),
    );

    // Parse the request body to verify structuredOutput is properly sent
    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(requestBody).toHaveProperty('structuredOutput');
    expect(requestBody.structuredOutput).toHaveProperty('schema');
    expect(requestBody.structuredOutput.schema).toEqual(
      expect.objectContaining({
        type: 'object',
        properties: expect.objectContaining({
          name: { type: 'string' },
          age: { type: 'number' },
        }),
      }),
    );
    // Verify no model is included in structuredOutput (should fallback to agent's model)
    expect(requestBody.structuredOutput).not.toHaveProperty('model');
  });

  it('generate: supports structuredOutput without explicit model', async () => {
    const mockJson = {
      id: 'gen-1',
      object: { name: 'Jane', age: 25 },
      finishReason: 'stop',
      usage: { totalTokens: 10 },
    };

    (global.fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify(mockJson), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const personSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const result = await agent.generate({
      messages: 'Create a person object',
      structuredOutput: {
        schema: personSchema,
        instructions: 'Generate a person with realistic data',
        // Note: No model provided - should fallback to agent's model
      },
    });

    expect(result).toEqual(mockJson);

    // Verify request contains structuredOutput in the body
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/agents/agent-1/generate',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringMatching(/structuredOutput/),
      }),
    );

    // Parse the request body to verify structuredOutput is properly sent
    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(requestBody).toHaveProperty('structuredOutput');
    expect(requestBody.structuredOutput).toHaveProperty('schema');
    expect(requestBody.structuredOutput).toHaveProperty('instructions', 'Generate a person with realistic data');
    expect(requestBody.structuredOutput.schema).toEqual(
      expect.objectContaining({
        type: 'object',
        properties: expect.objectContaining({
          name: { type: 'string' },
          age: { type: 'number' },
        }),
      }),
    );
    // Verify no model is included in structuredOutput (should fallback to agent's model)
    expect(requestBody.structuredOutput).not.toHaveProperty('model');
  });

  it('stream: should receive error chunks with serialized error properties', async () => {
    const testAPICallError = new APICallError({
      message: 'API Error',
      statusCode: 401,
      url: 'https://api.example.com',
      requestBodyValues: { test: 'test' },
      responseBody: 'Test API error response',
      isRetryable: false,
    });
    // Simulate server sending an error chunk
    // This test verifies that error properties are properly serialized over the wire
    const errorChunks = [
      { type: 'step-start', payload: { messageId: 'm1' } },
      { type: 'error', payload: { error: getErrorFromUnknown(testAPICallError) } },
    ];

    (global.fetch as any).mockResolvedValueOnce(sseResponse(errorChunks));

    const resp = await agent.stream({ messages: 'hi' });

    // Capture error chunks
    let errorChunk: any = null;
    await resp.processDataStream({
      onChunk: async chunk => {
        if (chunk.type === 'error') {
          errorChunk = chunk;
        }
      },
    });

    // Verify error chunk was received
    expect(errorChunk).toBeDefined();
    expect(errorChunk.type).toBe('error');

    // Verify error properties are preserved in serialization
    expect(errorChunk.payload.error).toBeDefined();
    expect(errorChunk.payload.error.message).toEqual(testAPICallError.message);
    expect(errorChunk.payload.error.statusCode).toEqual(testAPICallError.statusCode);
    expect(errorChunk.payload.error.requestBodyValues).toEqual(testAPICallError.requestBodyValues);
    expect(errorChunk.payload.error.responseBody).toEqual(testAPICallError.responseBody);
    expect(errorChunk.payload.error.isRetryable).toEqual(testAPICallError.isRetryable);
    expect(errorChunk.payload.error.url).toEqual(testAPICallError.url);
  });
});
