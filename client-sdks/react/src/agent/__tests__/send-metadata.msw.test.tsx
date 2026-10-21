// @vitest-environment jsdom
import type { SendAgentMessageParams, SendAgentSignalParams } from '@mastra/client-js';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../test/render';
import { useChat } from '../hooks';

const encoder = new TextEncoder();
const sse = (chunk: unknown) => encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`);

/**
 * Wires the thread-signal routes: an open subscription stream plus a
 * send-message route that records the request body and echoes the user
 * message back over the subscription, the way the server does.
 */
const useThreadSignalRoutes = ({ echo = true }: { echo?: boolean } = {}) => {
  const requests: SendAgentMessageParams[] = [];
  let subscription: ReadableStreamDefaultController<Uint8Array> | undefined;

  server.use(
    http.post(`${TEST_BASE_URL}/api/agents/agent-1/threads/subscribe`, () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          subscription = controller;
        },
      });
      return new HttpResponse(body, { headers: { 'content-type': 'text/event-stream' } });
    }),
    http.post<never, SendAgentMessageParams>(
      `${TEST_BASE_URL}/api/agents/agent-1/send-message`,
      async ({ request }) => {
        const body = await request.json();
        requests.push(body);
        const message = body.message as { contents: unknown; metadata?: Record<string, unknown> };
        if (echo) {
          subscription?.enqueue(
            sse({
              type: 'data-user-message',
              runId: 'run-1',
              data: { type: 'user-message', id: 'signal-1', contents: message.contents, metadata: message.metadata },
            }),
          );
        }
        return HttpResponse.json({ accepted: true, runId: 'run-1', signal: { id: 'signal-1' } });
      },
    ),
  );

  return { requests };
};

const renderChat = () =>
  renderHookWithProviders(() =>
    useChat({ agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1', enableThreadSignals: true }),
  );

describe('useChat sendMessage metadata', () => {
  it('sends custom metadata with the user message and keeps it on the rendered message', async () => {
    const { requests } = useThreadSignalRoutes();
    const { result } = renderChat();

    await act(async () => {
      await result.current.sendMessage({
        message: 'sync workspace',
        threadId: 'thread-1',
        metadata: { source: 'workspace-sync', tags: ['auto'] },
      });
    });

    expect(requests).toHaveLength(1);
    const outgoing = requests[0]!.message as { metadata: Record<string, unknown> };
    expect(outgoing.metadata).toEqual({
      source: 'workspace-sync',
      tags: ['auto'],
      clientMessageId: expect.stringMatching(/^client-set-/),
    });

    // The server echo reconciles the optimistic bubble (adopting the server id)
    // without dropping the caller's metadata.
    await waitFor(() => {
      const userMessages = result.current.messages.filter(message => message.role === 'user');
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0]!.id).toBe('signal-1');
      expect(userMessages[0]!.content.metadata).toMatchObject({ source: 'workspace-sync', tags: ['auto'] });
      expect(userMessages[0]!.content.metadata?.status).toBeUndefined();
    });
  });

  it('does not let custom metadata override the internal client message id or pending status', async () => {
    // No echo, so the optimistic bubble stays pending and can be inspected.
    const { requests } = useThreadSignalRoutes({ echo: false });
    const { result } = renderChat();

    await act(async () => {
      await result.current.sendMessage({
        message: 'hello',
        threadId: 'thread-1',
        metadata: { clientMessageId: 'spoofed', status: 'done', source: 'quick-action' },
      });
    });
    const pendingMetadata = result.current.messages.find(message => message.role === 'user')?.content.metadata;

    const outgoing = requests[0]!.message as { metadata: Record<string, unknown> };
    expect(outgoing.metadata.clientMessageId).toMatch(/^client-set-/);
    expect(outgoing.metadata.source).toBe('quick-action');
    expect(pendingMetadata).toMatchObject({
      status: 'pending',
      clientMessageId: outgoing.metadata.clientMessageId,
      source: 'quick-action',
    });
  });

  it('sends metadata on the signal fallback when the send-message route is unavailable', async () => {
    const signals: SendAgentSignalParams[] = [];
    server.use(
      http.post(`${TEST_BASE_URL}/api/agents/agent-1/threads/subscribe`, () => {
        const body = new ReadableStream<Uint8Array>();
        return new HttpResponse(body, { headers: { 'content-type': 'text/event-stream' } });
      }),
      http.post(`${TEST_BASE_URL}/api/agents/agent-1/send-message`, () =>
        HttpResponse.json({ error: 'Not Found' }, { status: 404 }),
      ),
      http.post<never, SendAgentSignalParams>(`${TEST_BASE_URL}/api/agents/agent-1/signals`, async ({ request }) => {
        signals.push(await request.json());
        return HttpResponse.json({ accepted: true, runId: 'run-1', signal: { id: 'signal-1' } });
      }),
    );
    const { result } = renderChat();

    await act(async () => {
      await result.current.sendMessage({
        message: 'hello',
        threadId: 'thread-1',
        metadata: { source: 'quick-action' },
      });
    });

    expect(signals).toHaveLength(1);
    expect(signals[0]!.signal.metadata).toEqual({ source: 'quick-action' });
  });

  it('leaves the outgoing message unchanged when no metadata is provided', async () => {
    const { requests } = useThreadSignalRoutes();
    const { result } = renderChat();

    await act(async () => {
      await result.current.sendMessage({ message: 'hello', threadId: 'thread-1' });
    });

    const outgoing = requests[0]!.message as { metadata: Record<string, unknown> };
    expect(Object.keys(outgoing.metadata)).toEqual(['clientMessageId']);
  });
});
