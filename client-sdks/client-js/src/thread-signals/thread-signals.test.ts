import { describe, expect, it, vi } from 'vitest';
import { createThreadSignalsClient } from './client';
import { processThreadSignalStream } from './stream';

function sseResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(event));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

describe('thread signals client', () => {
  it('parses fragmented SSE events without a platform-specific decoder', async () => {
    const chunks: unknown[] = [];
    await processThreadSignalStream({
      stream: sseResponse([
        'data: {"type":"start","runId":"run-1"}\r',
        '\n\r\ndata: {"type":"text-delta","payload":{"text":"hello"}}\n\n',
      ]).body!,
      onChunk: chunk => {
        chunks.push(chunk);
      },
    });

    expect(chunks).toEqual([
      { type: 'start', runId: 'run-1' },
      { type: 'text-delta', payload: { text: 'hello' } },
    ]);
  });

  it('stops dispatching buffered events after the stream is aborted', async () => {
    const controller = new AbortController();
    const chunks: unknown[] = [];

    await processThreadSignalStream({
      stream: sseResponse([
        'data: {"type":"start","runId":"run-1"}\n\ndata: {"type":"text-delta","payload":{"text":"late"}}\n\n',
      ]).body!,
      signal: controller.signal,
      onChunk: chunk => {
        chunks.push(chunk);
        controller.abort();
      },
    });

    expect(chunks).toEqual([{ type: 'start', runId: 'run-1' }]);
  });

  it('exposes the initial active-run snapshot on subscription', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(
        sseResponse([
          'data: {"type":"data-thread-state","data":{"runId":"run-1","status":"running","updatedAt":"2026-08-07T00:00:00.000Z"}}\n\n',
        ]),
      );
    const client = createThreadSignalsClient({
      baseUrl: 'https://example.com',
      agentId: 'agent-1',
      fetch,
    });
    const subscription = await client.subscribeToThread({ threadId: 'thread-1' });
    const snapshots: unknown[] = [];

    await subscription.processDataStream({
      onChunk: () => {},
      onSnapshot: snapshot => {
        snapshots.push(snapshot);
      },
    });

    expect(subscription.snapshot).toMatchObject({ runId: 'run-1', status: 'running' });
    expect(snapshots).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api/agents/agent-1/threads/subscribe',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses native message, queue, approval, and abort routes', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (_input, init) => {
      if (String(_input).endsWith('/threads/subscribe')) return sseResponse([]);
      const body = JSON.parse(String(init?.body)) as { toolCallId?: string };
      if (String(_input).endsWith('/threads/abort')) {
        return Response.json({ aborted: true });
      }
      return Response.json({
        accepted: true,
        runId: 'run-1',
        ...(body.toolCallId ? { toolCallId: body.toolCallId } : {}),
      });
    });
    const client = createThreadSignalsClient({
      baseUrl: 'https://example.com',
      agentId: 'agent-1',
      fetch,
    });

    await expect(client.sendMessage({ threadId: 'thread-1', message: 'start' })).resolves.toMatchObject({
      accepted: true,
    });
    await expect(client.queueMessage({ threadId: 'thread-1', message: 'next' })).resolves.toMatchObject({
      accepted: true,
    });
    await expect(
      client.sendToolApproval({
        threadId: 'thread-1',
        toolCallId: 'tool-1',
        approved: true,
      }),
    ).resolves.toMatchObject({ toolCallId: 'tool-1' });
    const subscription = await client.subscribeToThread({ threadId: 'thread-1' });
    await expect(subscription.abort()).resolves.toBe(true);
    subscription.unsubscribe();

    expect(fetch.mock.calls.map(([input]) => String(input))).toEqual([
      'https://example.com/api/agents/agent-1/send-message',
      'https://example.com/api/agents/agent-1/queue-message',
      'https://example.com/api/agents/agent-1/send-tool-approval',
      'https://example.com/api/agents/agent-1/threads/subscribe',
      'https://example.com/api/agents/agent-1/threads/abort',
    ]);
  });
});
