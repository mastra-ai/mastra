import type { Server } from 'node:http';
import { chatRoute } from '@mastra/ai-sdk';
import { Mastra } from '@mastra/core';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

const decoder = new TextDecoder();

function createSseFrameReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  let buffer = '';

  return async () => {
    while (true) {
      const frameEnd = buffer.indexOf('\n\n');
      if (frameEnd !== -1) {
        const frame = buffer.slice(0, frameEnd + 2);
        buffer = buffer.slice(frameEnd + 2);
        return frame;
      }

      const result = await reader.read();
      if (result.done) throw new Error('Stream ended before receiving a complete SSE frame');
      buffer += decoder.decode(result.value, { stream: true });
    }
  };
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), 5_000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

describe('chatRoute heartbeat through Express', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (!server) return;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server!.close(error => (error ? reject(error) : resolve())));
    server = undefined;
  });

  it('streams idle heartbeats and AI SDK events, then aborts the agent on disconnect', async () => {
    let streamController!: ReadableStreamDefaultController;
    const fullStream = new ReadableStream({
      start(controller) {
        streamController = controller;
      },
    });
    const agent = {
      stream: vi.fn().mockResolvedValue({ fullStream }),
    };
    const mastra = new Mastra({});
    // chatRoute only calls stream(), so a full Agent would add unrelated model setup to this transport test.
    vi.spyOn(mastra, 'getAgentById').mockReturnValue(agent as never);

    const app = express();
    app.use(express.json());
    const adapter = new MastraServer({
      app,
      mastra,
      customApiRoutes: [chatRoute({ path: '/chat/:agentId', heartbeatMs: 25 })],
    });
    await adapter.init();

    const listeningServer: Server = await new Promise(resolve => {
      const startedServer = app.listen(0, '127.0.0.1', () => resolve(startedServer));
    });
    server = listeningServer;
    const address = listeningServer.address();
    if (!address || typeof address === 'string') throw new Error('Failed to get server address');

    const clientAbort = new AbortController();
    const response = await withTimeout(
      fetch(`http://127.0.0.1:${address.port}/chat/test-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
        }),
        signal: clientAbort.signal,
      }),
      'HTTP response headers',
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const reader = response.body!.getReader();
    const readFrame = createSseFrameReader(reader);
    expect(await withTimeout(readFrame(), 'heartbeat frame')).toBe(': heartbeat\n\n');

    streamController.enqueue({
      type: 'start',
      runId: 'run-1',
      from: 'AGENT',
      payload: { messageId: 'assistant-1' },
    });
    streamController.enqueue({
      type: 'text-start',
      runId: 'run-1',
      from: 'AGENT',
      payload: { id: 'text-1' },
    });

    let eventFrame = await withTimeout(readFrame(), 'AI SDK event frame');
    while (eventFrame.startsWith(':')) {
      expect(eventFrame).toBe(': heartbeat\n\n');
      eventFrame = await withTimeout(readFrame(), 'AI SDK event frame');
    }
    expect(eventFrame.startsWith('data: ')).toBe(true);
    expect(JSON.parse(eventFrame.slice('data: '.length))).toMatchObject({ type: 'start' });

    expect(agent.stream).toHaveBeenCalledOnce();
    const agentOptions = agent.stream.mock.calls[0]![1] as { abortSignal: AbortSignal };
    expect(agentOptions.abortSignal.aborted).toBe(false);

    clientAbort.abort();
    await vi.waitFor(() => expect(agentOptions.abortSignal.aborted).toBe(true), { timeout: 5_000 });
  }, 10_000);
});
