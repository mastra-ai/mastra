import { createTool } from '@mastra/core';
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

  it('streamVNext: completes when server sends finish without tool calls', async () => {
    // step-start -> text-delta -> step-finish -> finish: stop
    const sseChunks = [
      { type: 'step-start', payload: { messageId: 'm1' } },
      { type: 'text-delta', payload: { text: 'Hello' } },
      { type: 'step-finish', payload: { stepResult: { isContinued: false } } },
      { type: 'finish', payload: { stepResult: { reason: 'stop' }, usage: { totalTokens: 1 } } },
    ];

    (global.fetch as any).mockResolvedValueOnce(sseResponse(sseChunks));

    const resp = await agent.streamVNext({ messages: 'hi' });

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
      'http://localhost:4111/api/agents/agent-1/stream/vnext',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('streamVNext: executes client tool and triggers recursive call on finish reason tool-calls', async () => {
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

    const resp = await agent.streamVNext({ messages: 'weather?', clientTools: { weatherTool } });

    await resp.processDataStream({ onChunk: async _chunk => {} });

    // Client tool executed
    expect(executeSpy).toHaveBeenCalledTimes(1);
    // Recursive request made
    expect((global.fetch as any).mock.calls.filter((c: any[]) => (c?.[0] as string).includes('/vnext')).length).toBe(2);
  });

  it('generate: returns JSON using mocked fetch', async () => {
    const mockJson = { id: 'gen-1', text: 'ok' };
    (global.fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify(mockJson), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const result = await agent.generateVNext({ prompt: 'hello' } as any);
    expect(result).toEqual(mockJson);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4111/api/agents/agent-1/generate/vnext',
      expect.objectContaining({
        body: '{"prompt":"hello"}',
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
});
