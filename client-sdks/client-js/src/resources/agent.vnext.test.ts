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

    let lastChunk: any = null;
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

  it('stream: receives chunks from both initial and recursive requests', async () => {
    const toolCallId = 'call_1';

    // First cycle: emit text before tool call
    const firstCycle = [
      { type: 'step-start', payload: { messageId: 'm1' } },
      { type: 'text-delta', payload: { text: 'Let me check the weather' } },
      {
        type: 'tool-call',
        payload: { toolCallId, toolName: 'weatherTool', args: { location: 'NYC' } },
      },
      { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
      { type: 'finish', payload: { stepResult: { reason: 'tool-calls' }, usage: { totalTokens: 2 } } },
    ];

    // Second cycle: emit text after tool execution
    const secondCycle = [
      { type: 'step-start', payload: { messageId: 'm2' } },
      { type: 'text-delta', payload: { text: 'The weather is sunny' } },
      { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
      { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 5 } } },
    ];

    (global.fetch as any)
      .mockResolvedValueOnce(sseResponse(firstCycle))
      .mockResolvedValueOnce(sseResponse(secondCycle));

    const executeSpy = vi.fn(async () => ({ temperature: 72, condition: 'sunny' }));
    const weatherTool = createTool({
      id: 'weatherTool',
      description: 'Get weather',
      inputSchema: z.object({ location: z.string() }),
      outputSchema: z.object({ temperature: z.number(), condition: z.string() }),
      execute: executeSpy,
    });

    const resp = await agent.stream({ messages: 'What is the weather?', clientTools: { weatherTool } });

    const receivedChunks: any[] = [];
    await resp.processDataStream({
      onChunk: async chunk => {
        receivedChunks.push(chunk);
      },
    });

    // Verify we received chunks from both cycles
    const textDeltas = receivedChunks.filter(c => c.type === 'text-delta');
    expect(textDeltas).toHaveLength(2);
    expect(textDeltas[0].payload.text).toBe('Let me check the weather');
    expect(textDeltas[1].payload.text).toBe('The weather is sunny');

    // Verify tool was executed
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith(
      { location: 'NYC' },
      expect.objectContaining({
        agent: expect.objectContaining({
          toolCallId,
        }),
      }),
    );

    // Verify total chunks received (from both cycles)
    expect(receivedChunks.length).toBeGreaterThan(5); // At least step-start + text + tool + step-finish + finish per cycle
  });

  describe('MastraClientModelOutput API', () => {
    it('fullStream: should iterate over chunks using async iterator', async () => {
      const sseChunks = [
        { type: 'step-start', payload: { messageId: 'm1' } },
        { type: 'text-delta', payload: { text: 'Hello ' } },
        { type: 'text-delta', payload: { text: 'world' } },
        { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
        { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 10 } } },
      ];

      (global.fetch as any).mockResolvedValueOnce(sseResponse(sseChunks));

      const stream = await agent.stream({ messages: 'Hello' });

      // Test async iterator pattern
      const receivedChunks: any[] = [];
      for await (const chunk of stream.fullStream) {
        receivedChunks.push(chunk);
      }

      // Verify all chunks were received
      expect(receivedChunks).toHaveLength(5);
      expect(receivedChunks[0].type).toBe('step-start');
      expect(receivedChunks[1].type).toBe('text-delta');
      expect(receivedChunks[1].payload.text).toBe('Hello ');
      expect(receivedChunks[2].type).toBe('text-delta');
      expect(receivedChunks[2].payload.text).toBe('world');
      expect(receivedChunks[3].type).toBe('step-finish');
      expect(receivedChunks[4].type).toBe('finish');
    });

    it('text: should resolve to complete text after streaming', async () => {
      const sseChunks = [
        { type: 'step-start', payload: { messageId: 'm1' } },
        { type: 'text-delta', payload: { text: 'The ' } },
        { type: 'text-delta', payload: { text: 'weather ' } },
        { type: 'text-delta', payload: { text: 'is ' } },
        { type: 'text-delta', payload: { text: 'sunny' } },
        { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
        { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 15 } } },
      ];

      (global.fetch as any).mockResolvedValueOnce(sseResponse(sseChunks));

      const stream = await agent.stream({ messages: 'What is the weather?' });

      // Test awaiting text property
      const text = await stream.text;

      expect(text).toBe('The weather is sunny');
    });

    it('usage: should resolve to token usage after streaming', async () => {
      const sseChunks = [
        { type: 'step-start', payload: { messageId: 'm1' } },
        { type: 'text-delta', payload: { text: 'Response' } },
        { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
        {
          type: 'finish',
          payload: {
            stepResult: { reason: 'stop' },
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
        },
      ];

      (global.fetch as any).mockResolvedValueOnce(sseResponse(sseChunks));

      const stream = await agent.stream({ messages: 'Test' });

      // Test awaiting usage property
      const usage = await stream.usage;

      expect(usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
    });

    it('toolCalls: should resolve to tool calls after streaming', async () => {
      const toolCallId = 'call_123';
      const sseChunks = [
        { type: 'step-start', payload: { messageId: 'm1' } },
        { type: 'text-delta', payload: { text: 'Let me check' } },
        {
          type: 'tool-call',
          payload: { toolCallId, toolName: 'weatherTool', args: { location: 'SF' } },
        },
        { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
        { type: 'finish', payload: { stepResult: { reason: 'tool-calls' }, usage: { totalTokens: 20 } } },
      ];

      (global.fetch as any).mockResolvedValueOnce(sseResponse(sseChunks));

      const stream = await agent.stream({ messages: 'Check weather' });

      // Test awaiting toolCalls property
      const toolCalls = await stream.toolCalls;

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]).toEqual({
        toolCallId,
        toolName: 'weatherTool',
        args: { location: 'SF' },
      });
    });

    it('finishReason: should resolve to finish reason after streaming', async () => {
      const sseChunks = [
        { type: 'step-start', payload: { messageId: 'm1' } },
        { type: 'text-delta', payload: { text: 'Done' } },
        { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
        { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 5 } } },
      ];

      (global.fetch as any).mockResolvedValueOnce(sseResponse(sseChunks));

      const stream = await agent.stream({ messages: 'Test' });

      // Test awaiting finishReason property
      const finishReason = await stream.finishReason;

      expect(finishReason).toBe('stop');
    });

    it('should support both fullStream iteration and property awaiting simultaneously', async () => {
      const sseChunks = [
        { type: 'step-start', payload: { messageId: 'm1' } },
        { type: 'text-delta', payload: { text: 'Hello' } },
        { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
        { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 8 } } },
      ];

      (global.fetch as any).mockResolvedValueOnce(sseResponse(sseChunks));

      const stream = await agent.stream({ messages: 'Hi' });

      // Start consuming fullStream
      const chunks: any[] = [];
      const streamPromise = (async () => {
        for await (const chunk of stream.fullStream) {
          chunks.push(chunk);
        }
      })();

      // Await properties simultaneously
      const [text, usage, finishReason] = await Promise.all([stream.text, stream.usage, stream.finishReason]);

      // Wait for stream to complete
      await streamPromise;

      // Verify both patterns worked
      expect(chunks).toHaveLength(4);
      expect(text).toBe('Hello');
      expect(usage.totalTokens).toBe(8);
      expect(finishReason).toBe('stop');
    });

    it('fullStream: should work with tool execution flow', async () => {
      const toolCallId = 'call_1';

      const firstCycle = [
        { type: 'step-start', payload: { messageId: 'm1' } },
        { type: 'text-delta', payload: { text: 'Checking...' } },
        {
          type: 'tool-call',
          payload: { toolCallId, toolName: 'testTool', args: { input: 'test' } },
        },
        { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
        { type: 'finish', payload: { stepResult: { reason: 'tool-calls' }, usage: { totalTokens: 5 } } },
      ];

      const secondCycle = [
        { type: 'step-start', payload: { messageId: 'm2' } },
        { type: 'text-delta', payload: { text: 'Result: success' } },
        { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
        { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 10 } } },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce(sseResponse(firstCycle))
        .mockResolvedValueOnce(sseResponse(secondCycle));

      const executeSpy = vi.fn(async () => ({ result: 'success' }));
      const testTool = createTool({
        id: 'testTool',
        description: 'Test tool',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: executeSpy,
      });

      const stream = await agent.stream({ messages: 'Test', clientTools: { testTool } });

      // Consume stream with fullStream
      const chunks: any[] = [];
      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      // Verify chunks from both cycles
      const textChunks = chunks.filter(c => c.type === 'text-delta');
      expect(textChunks).toHaveLength(2);
      expect(textChunks[0].payload.text).toBe('Checking...');
      expect(textChunks[1].payload.text).toBe('Result: success');

      // Verify tool was executed
      expect(executeSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Backward Compatibility: processDataStream (deprecated)', () => {
    it('processDataStream: should still work for backward compatibility', async () => {
      const sseChunks = [
        { type: 'step-start', payload: { messageId: 'm1' } },
        { type: 'text-delta', payload: { text: 'Legacy ' } },
        { type: 'text-delta', payload: { text: 'support' } },
        { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
        { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 5 } } },
      ];

      (global.fetch as any).mockResolvedValueOnce(sseResponse(sseChunks));

      const stream = await agent.stream({ messages: 'Test legacy' });

      // Test deprecated processDataStream method
      const receivedChunks: any[] = [];
      await stream.processDataStream({
        onChunk: async chunk => {
          receivedChunks.push(chunk);
        },
      });

      // Verify it still works as expected
      expect(receivedChunks).toHaveLength(5);
      const textDeltas = receivedChunks.filter(c => c.type === 'text-delta');
      expect(textDeltas).toHaveLength(2);
      expect(textDeltas[0].payload.text).toBe('Legacy ');
      expect(textDeltas[1].payload.text).toBe('support');
    });

    it('processDataStream: should work with tool execution', async () => {
      const toolCallId = 'call_legacy';

      const firstCycle = [
        { type: 'step-start', payload: { messageId: 'm1' } },
        {
          type: 'tool-call',
          payload: { toolCallId, toolName: 'legacyTool', args: { value: 42 } },
        },
        { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
        { type: 'finish', payload: { stepResult: { reason: 'tool-calls' }, usage: { totalTokens: 3 } } },
      ];

      const secondCycle = [
        { type: 'step-start', payload: { messageId: 'm2' } },
        { type: 'text-delta', payload: { text: 'Tool result received' } },
        { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
        { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 8 } } },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce(sseResponse(firstCycle))
        .mockResolvedValueOnce(sseResponse(secondCycle));

      const executeSpy = vi.fn(async () => ({ status: 'ok' }));
      const legacyTool = createTool({
        id: 'legacyTool',
        description: 'Legacy tool',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ status: z.string() }),
        execute: executeSpy,
      });

      const stream = await agent.stream({ messages: 'Test', clientTools: { legacyTool } });

      // Use deprecated API
      const chunks: any[] = [];
      await stream.processDataStream({
        onChunk: async chunk => {
          chunks.push(chunk);
        },
      });

      // Verify tool execution and chunks
      expect(executeSpy).toHaveBeenCalledOnce();
      const textChunks = chunks.filter(c => c.type === 'text-delta');
      expect(textChunks).toHaveLength(1);
      expect(textChunks[0].payload.text).toBe('Tool result received');
    });
  });

  it('stream: handles multiple sequential client tool calls', async () => {
    // First cycle: first tool call
    const firstCycle = [
      { type: 'step-start', payload: { messageId: 'm1' } },
      {
        type: 'tool-call',
        payload: { toolCallId: 'call_1', toolName: 'weatherTool', args: { location: 'NYC' } },
      },
      { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
      { type: 'finish', payload: { stepResult: { reason: 'tool-calls' }, usage: { totalTokens: 2 } } },
    ];

    // Second cycle: another tool call
    const secondCycle = [
      { type: 'step-start', payload: { messageId: 'm2' } },
      {
        type: 'tool-call',
        payload: { toolCallId: 'call_2', toolName: 'newsTool', args: { topic: 'weather' } },
      },
      { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
      { type: 'finish', payload: { stepResult: { reason: 'tool-calls' }, usage: { totalTokens: 4 } } },
    ];

    // Third cycle: final response
    const thirdCycle = [
      { type: 'step-start', payload: { messageId: 'm3' } },
      { type: 'text-delta', payload: { text: 'Here is your complete update' } },
      { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
      { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 8 } } },
    ];

    (global.fetch as any)
      .mockResolvedValueOnce(sseResponse(firstCycle))
      .mockResolvedValueOnce(sseResponse(secondCycle))
      .mockResolvedValueOnce(sseResponse(thirdCycle));

    const weatherExecuteSpy = vi.fn(async () => ({ temperature: 72 }));
    const newsExecuteSpy = vi.fn(async () => ({ headlines: ['Sunny tomorrow'] }));

    const weatherTool = createTool({
      id: 'weatherTool',
      description: 'Get weather',
      inputSchema: z.object({ location: z.string() }),
      outputSchema: z.object({ temperature: z.number() }),
      execute: weatherExecuteSpy,
    });

    const newsTool = createTool({
      id: 'newsTool',
      description: 'Get news',
      inputSchema: z.object({ topic: z.string() }),
      outputSchema: z.object({ headlines: z.array(z.string()) }),
      execute: newsExecuteSpy,
    });

    const resp = await agent.stream({
      messages: 'Give me weather and news',
      clientTools: { weatherTool, newsTool },
    });

    const receivedChunks: any[] = [];
    await resp.processDataStream({
      onChunk: async chunk => {
        receivedChunks.push(chunk);
      },
    });

    // Verify both tools were executed
    expect(weatherExecuteSpy).toHaveBeenCalledTimes(1);
    expect(newsExecuteSpy).toHaveBeenCalledTimes(1);

    // Verify we received chunks from all three cycles
    const finishChunks = receivedChunks.filter(c => c.type === 'finish');
    expect(finishChunks).toHaveLength(3);
    expect(finishChunks[0].payload.stepResult.reason).toBe('tool-calls');
    expect(finishChunks[1].payload.stepResult.reason).toBe('tool-calls');
    expect(finishChunks[2].payload.stepResult.reason).toBe('stop');

    // Verify three requests were made
    expect(global.fetch).toHaveBeenCalledTimes(3);
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

    let lastChunk: any = null;
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

  it('generate: executes client tool and returns final response', async () => {
    const toolCallId = 'call_1';

    // First call returns tool-calls
    const firstResponse = {
      finishReason: 'tool-calls',
      toolCalls: [
        {
          payload: {
            toolCallId,
            toolName: 'weatherTool',
            args: { location: 'NYC' },
          },
        },
      ],
      response: {
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId,
                toolName: 'weatherTool',
                args: { location: 'NYC' },
              },
            ],
          },
        ],
      },
      usage: { totalTokens: 2 },
    };

    // Second call (after tool execution) returns final response
    const secondResponse = {
      finishReason: 'stop',
      response: {
        messages: [
          {
            role: 'assistant',
            content: 'The weather in NYC is sunny with 72°F',
          },
        ],
      },
      usage: { totalTokens: 5 },
    };

    (global.fetch as any)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(firstResponse), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(secondResponse), { status: 200, headers: { 'content-type': 'application/json' } }),
      );

    const executeSpy = vi.fn(async () => ({ temperature: 72, condition: 'sunny' }));
    const weatherTool = createTool({
      id: 'weatherTool',
      description: 'Get weather',
      inputSchema: z.object({ location: z.string() }),
      outputSchema: z.object({ temperature: z.number(), condition: z.string() }),
      execute: executeSpy,
    });

    const result = await agent.generate('What is the weather in NYC?', { clientTools: { weatherTool } });

    expect(result.finishReason).toBe('stop');
    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(executeSpy).toHaveBeenCalledWith(
      { location: 'NYC' },
      expect.objectContaining({
        agent: expect.objectContaining({
          toolCallId,
        }),
      }),
    );

    // Verify two requests were made
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Verify the second request includes the tool result
    const secondCallBody = JSON.parse((global.fetch as any).mock.calls[1][1].body);
    expect(secondCallBody.messages).toContainEqual(
      expect.objectContaining({
        role: 'tool',
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'tool-result',
            toolCallId,
            toolName: 'weatherTool',
            result: { temperature: 72, condition: 'sunny' },
          }),
        ]),
      }),
    );
  });

  it('generate: handles multiple client tool calls', async () => {
    // First call returns first tool call
    const firstResponse = {
      finishReason: 'tool-calls',
      toolCalls: [
        {
          payload: {
            toolCallId: 'call_1',
            toolName: 'weatherTool',
            args: { location: 'NYC' },
          },
        },
      ],
      response: {
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_1',
                toolName: 'weatherTool',
                args: { location: 'NYC' },
              },
            ],
          },
        ],
      },
      usage: { totalTokens: 2 },
    };

    // Second call returns another tool call
    const secondResponse = {
      finishReason: 'tool-calls',
      toolCalls: [
        {
          payload: {
            toolCallId: 'call_2',
            toolName: 'newsTool',
            args: { topic: 'weather' },
          },
        },
      ],
      response: {
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_2',
                toolName: 'newsTool',
                args: { topic: 'weather' },
              },
            ],
          },
        ],
      },
      usage: { totalTokens: 4 },
    };

    // Third call returns final response
    const thirdResponse = {
      finishReason: 'stop',
      response: {
        messages: [
          {
            role: 'assistant',
            content: 'Based on the weather and news, here is your update...',
          },
        ],
      },
      usage: { totalTokens: 8 },
    };

    (global.fetch as any)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(firstResponse), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(secondResponse), { status: 200, headers: { 'content-type': 'application/json' } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(thirdResponse), { status: 200, headers: { 'content-type': 'application/json' } }),
      );

    const weatherExecuteSpy = vi.fn(async () => ({ temperature: 72, condition: 'sunny' }));
    const newsExecuteSpy = vi.fn(async () => ({ headlines: ['Weather improves tomorrow'] }));

    const weatherTool = createTool({
      id: 'weatherTool',
      description: 'Get weather',
      inputSchema: z.object({ location: z.string() }),
      outputSchema: z.object({ temperature: z.number(), condition: z.string() }),
      execute: weatherExecuteSpy,
    });

    const newsTool = createTool({
      id: 'newsTool',
      description: 'Get news',
      inputSchema: z.object({ topic: z.string() }),
      outputSchema: z.object({ headlines: z.array(z.string()) }),
      execute: newsExecuteSpy,
    });

    const result = await agent.generate('Give me weather and news update', {
      clientTools: { weatherTool, newsTool },
    });

    expect(result.finishReason).toBe('stop');
    expect(weatherExecuteSpy).toHaveBeenCalledTimes(1);
    expect(newsExecuteSpy).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('generate: skips client tool without execute function', async () => {
    const toolCallId = 'call_1';

    // First and only call returns tool-calls
    const firstResponse = {
      finishReason: 'tool-calls',
      toolCalls: [
        {
          payload: {
            toolCallId,
            toolName: 'weatherTool',
            args: { location: 'NYC' },
          },
        },
      ],
      response: {
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId,
                toolName: 'weatherTool',
                args: { location: 'NYC' },
              },
            ],
          },
        ],
      },
      usage: { totalTokens: 2 },
    };

    (global.fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify(firstResponse), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    // Tool without execute function
    const weatherTool = createTool({
      id: 'weatherTool',
      description: 'Get weather',
      inputSchema: z.object({ location: z.string() }),
      outputSchema: z.object({ temperature: z.number(), condition: z.string() }),
    });

    const result = await agent.generate('What is the weather?', { clientTools: { weatherTool } });

    // When a tool doesn't have an execute function, the response is returned as-is
    expect(result.finishReason).toBe('tool-calls');
    expect(result.toolCalls).toBeDefined();
    expect(result.toolCalls).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
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
    expect(errorChunk).not.toBeNull();
    expect(errorChunk).toBeDefined();

    if (!errorChunk) {
      throw new Error('Error chunk was not received');
    }

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

  // Tests for network API (MastraClientNetworkOutput)
  describe('MastraClientNetworkOutput API', () => {
    it('fullStream: should iterate over network chunks using async iterator', async () => {
      const networkChunks = [
        { type: 'routing-agent-start', payload: { agentId: 'router', task: 'route request' } },
        { type: 'agent-execution-start', payload: { agentId: 'agent-1', task: 'execute task' } },
        { type: 'agent-execution-end', payload: { agentId: 'agent-1', usage: { totalTokens: 10 } } },
        {
          type: 'network-execution-event-finish',
          payload: {
            task: 'Main task',
            result: 'Task completed',
            completionReason: 'success',
            primitiveId: 'net-1',
            primitiveType: 'agent',
            prompt: 'test',
            iteration: 1,
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          },
        },
      ];

      (global.fetch as any).mockResolvedValueOnce(sseResponse(networkChunks));

      const stream = await agent.network({ messages: 'Test network' });

      // Test async iterator pattern
      const receivedChunks: any[] = [];
      for await (const chunk of stream.fullStream) {
        receivedChunks.push(chunk);
      }

      // Verify all chunks were received
      expect(receivedChunks).toHaveLength(4);
      expect(receivedChunks[0].type).toBe('routing-agent-start');
      expect(receivedChunks[1].type).toBe('agent-execution-start');
      expect(receivedChunks[2].type).toBe('agent-execution-end');
      expect(receivedChunks[3].type).toBe('network-execution-event-finish');
    });

    it('usage: should accumulate usage from multiple agents', async () => {
      const networkChunks = [
        { type: 'routing-agent-start', payload: { agentId: 'router' } },
        {
          type: 'routing-agent-end',
          payload: { agentId: 'router', usage: { totalTokens: 5, inputTokens: 2, outputTokens: 3 } },
        },
        { type: 'agent-execution-start', payload: { agentId: 'agent-1' } },
        {
          type: 'agent-execution-end',
          payload: { agentId: 'agent-1', usage: { totalTokens: 10, inputTokens: 4, outputTokens: 6 } },
        },
        { type: 'agent-execution-start', payload: { agentId: 'agent-2' } },
        {
          type: 'agent-execution-end',
          payload: { agentId: 'agent-2', usage: { totalTokens: 8, inputTokens: 3, outputTokens: 5 } },
        },
        {
          type: 'network-execution-event-finish',
          payload: {
            task: 'Complete',
            result: 'done',
            completionReason: 'success',
            primitiveId: 'net-1',
            primitiveType: 'agent',
            prompt: 'test',
            iteration: 1,
            usage: { inputTokens: 9, outputTokens: 14, totalTokens: 23 },
          },
        },
      ];

      (global.fetch as any).mockResolvedValueOnce(sseResponse(networkChunks));

      const stream = await agent.network({ messages: 'Multi-agent test' });

      // Test awaiting usage property
      const usage = await stream.usage;

      // Should use the usage from the finish event (which is the accumulated total from the server)
      // When finish event provides usage, it replaces the accumulated count
      expect(usage.inputTokens).toBe(9);
      expect(usage.outputTokens).toBe(14);
      expect(usage.totalTokens).toBe(23);
    });

    it('result: should resolve to network execution result', async () => {
      const networkChunks = [
        { type: 'agent-execution-start', payload: { agentId: 'agent-1' } },
        { type: 'agent-execution-end', payload: { agentId: 'agent-1' } },
        {
          type: 'network-execution-event-finish',
          payload: {
            task: 'Analyze data',
            result: 'Analysis complete: positive sentiment',
            completionReason: 'success',
            primitiveId: 'net-1',
            primitiveType: 'agent',
            prompt: 'Analyze this',
            iteration: 1,
            isComplete: true,
          },
        },
      ];

      (global.fetch as any).mockResolvedValueOnce(sseResponse(networkChunks));

      const stream = await agent.network({ messages: 'Analyze' });

      // Test awaiting result property
      const result = await stream.result;

      expect(result).toEqual({
        task: 'Analyze data',
        result: 'Analysis complete: positive sentiment',
        completionReason: 'success',
        primitiveId: 'net-1',
        primitiveType: 'agent',
        prompt: 'Analyze this',
        iteration: 1,
        isComplete: true,
      });
    });

    it('status: should resolve to completion reason', async () => {
      const networkChunks = [
        { type: 'agent-execution-start', payload: { agentId: 'agent-1' } },
        { type: 'agent-execution-end', payload: { agentId: 'agent-1' } },
        {
          type: 'network-execution-event-finish',
          payload: {
            task: 'Task',
            result: 'done',
            completionReason: 'max-iterations',
            primitiveId: 'net-1',
            primitiveType: 'agent',
            prompt: 'test',
            iteration: 5,
          },
        },
      ];

      (global.fetch as any).mockResolvedValueOnce(sseResponse(networkChunks));

      const stream = await agent.network({ messages: 'Test' });

      // Test awaiting status property
      const status = await stream.status;

      expect(status).toBe('max-iterations');
    });

    it('should support both fullStream iteration and property awaiting simultaneously', async () => {
      const networkChunks = [
        { type: 'agent-execution-start', payload: { agentId: 'agent-1' } },
        { type: 'agent-execution-end', payload: { agentId: 'agent-1', usage: { totalTokens: 15 } } },
        {
          type: 'network-execution-event-finish',
          payload: {
            task: 'Task',
            result: 'Complete',
            completionReason: 'success',
            primitiveId: 'net-1',
            primitiveType: 'agent',
            prompt: 'test',
            iteration: 1,
            usage: { inputTokens: 7, outputTokens: 8, totalTokens: 15 },
          },
        },
      ];

      (global.fetch as any).mockResolvedValueOnce(sseResponse(networkChunks));

      const stream = await agent.network({ messages: 'Test' });

      // Start consuming fullStream
      const chunks: any[] = [];
      const streamPromise = (async () => {
        for await (const chunk of stream.fullStream) {
          chunks.push(chunk);
        }
      })();

      // Await properties simultaneously
      const [usage, result, status] = await Promise.all([stream.usage, stream.result, stream.status]);

      // Wait for stream to complete
      await streamPromise;

      // Verify both patterns worked
      expect(chunks).toHaveLength(3);
      expect(usage.totalTokens).toBe(15);
      expect(result.result).toBe('Complete');
      expect(status).toBe('success');
    });

    it('fullStream: should work with workflow execution', async () => {
      const networkChunks = [
        { type: 'workflow-execution-start', payload: { workflowId: 'wf-1' } },
        { type: 'workflow-execution-end', payload: { workflowId: 'wf-1', usage: { totalTokens: 25 } } },
        {
          type: 'network-execution-event-finish',
          payload: {
            task: 'Workflow task',
            result: 'Workflow completed',
            completionReason: 'success',
            primitiveId: 'wf-1',
            primitiveType: 'workflow',
            prompt: 'run workflow',
            iteration: 1,
            usage: { inputTokens: 12, outputTokens: 13, totalTokens: 25 },
          },
        },
      ];

      (global.fetch as any).mockResolvedValueOnce(sseResponse(networkChunks));

      const stream = await agent.network({ messages: 'Run workflow' });

      // Consume stream with fullStream
      const chunks: any[] = [];
      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      // Verify chunks
      expect(chunks).toHaveLength(3);
      expect(chunks[0].type).toBe('workflow-execution-start');
      expect(chunks[1].type).toBe('workflow-execution-end');
      expect(chunks[2].type).toBe('network-execution-event-finish');
      expect(chunks[2].payload.primitiveType).toBe('workflow');
    });
  });

  // Regression test for deprecated processDataStream on network
  describe('Backward Compatibility: network processDataStream (deprecated)', () => {
    it('processDataStream: should still work for backward compatibility', async () => {
      const networkChunks = [
        { type: 'agent-execution-start', payload: { agentId: 'agent-1' } },
        { type: 'agent-execution-end', payload: { agentId: 'agent-1' } },
        {
          type: 'network-execution-event-finish',
          payload: {
            task: 'Legacy task',
            result: 'Legacy support',
            completionReason: 'success',
            primitiveId: 'net-1',
            primitiveType: 'agent',
            prompt: 'test',
            iteration: 1,
          },
        },
      ];

      (global.fetch as any).mockResolvedValueOnce(sseResponse(networkChunks));

      const stream = await agent.network({ messages: 'Test legacy' });

      // Test deprecated processDataStream method
      const receivedChunks: any[] = [];
      await stream.processDataStream({
        onChunk: async chunk => {
          receivedChunks.push(chunk);
        },
      });

      // Verify it still works as expected
      expect(receivedChunks).toHaveLength(3);
      expect(receivedChunks[0].type).toBe('agent-execution-start');
      expect(receivedChunks[1].type).toBe('agent-execution-end');
      expect(receivedChunks[2].type).toBe('network-execution-event-finish');
    });
  });
});
