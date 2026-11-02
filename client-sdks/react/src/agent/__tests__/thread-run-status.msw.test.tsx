// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../test/render';
import { useChat } from '../hooks';

describe('useChat thread outcomes (COR-1500)', () => {
  it.each(
    (['history', 'send-message', 'status-before-response', 'prior-run-finishes'] as const).flatMap(identitySource =>
      (['success', 'failed', 'aborted', 'suspended'] as const).map(status => ({ identitySource, status })),
    ),
  )('settles $status identified by $identitySource without a start frame', async ({ identitySource, status }) => {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    const response = Promise.withResolvers<void>();
    let requested = false;
    server.use(
      http.post(
        `${TEST_BASE_URL}/api/agents/agent-1/threads/subscribe`,
        () =>
          new HttpResponse(
            new ReadableStream<Uint8Array>({
              start(value) {
                controller = value;
              },
            }),
            {
              headers: { 'content-type': 'text/event-stream' },
            },
          ),
      ),
      http.post(`${TEST_BASE_URL}/api/agents/agent-1/send-message`, async () => {
        requested = true;
        await response.promise;
        return HttpResponse.json({ runId: 'recovered-run', signal: { id: 'signal-1' } });
      }),
    );
    const { result, unmount } = renderHookWithProviders(() =>
      useChat({
        agentId: 'agent-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        enableThreadSignals: true,
        withInitialHistory: true,
      }),
    );
    const emit = async (chunk: unknown) => {
      await act(async () => {
        controller?.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
      });
    };
    let sending: Promise<void> | undefined;
    try {
      await waitFor(() => expect(controller).toBeDefined());
      if (identitySource === 'prior-run-finishes') {
        await emit({ type: 'start', runId: 'old-run', from: 'AGENT', payload: {} });
      }
      act(() => {
        sending = result.current.sendMessage({ message: 'Recover my reply', threadId: 'thread-1' });
      });
      await waitFor(() => expect(requested).toBe(true));
      expect(result.current.isRunning).toBe(true);
      if (identitySource === 'history') {
        await emit({
          type: 'thread-history',
          runId: '',
          from: 'AGENT',
          payload: { messages: [], hasMore: false, activeRunId: 'recovered-run' },
        });
      } else if (identitySource === 'send-message' || identitySource === 'prior-run-finishes') {
        if (identitySource === 'prior-run-finishes') {
          await emit({ type: 'thread-run-status', runId: 'old-run', from: 'AGENT', payload: { status: 'success' } });
          await waitFor(() => expect(result.current.isRunning).toBe(false));
        }
        response.resolve();
        await act(async () => {
          await sending;
        });
      }
      await emit({ type: 'thread-run-status', runId: 'old-run', from: 'AGENT', payload: { status: 'success' } });
      expect(result.current.isRunning).toBe(true);
      await emit({
        type: 'thread-run-status',
        runId: 'recovered-run',
        from: 'AGENT',
        payload: { status },
      });
      if (identitySource === 'status-before-response') {
        response.resolve();
        await act(async () => {
          await sending;
        });
      }
      await waitFor(() => expect(result.current.isRunning).toBe(false));
      await emit({ type: 'start', runId: 'newer-run', from: 'AGENT', payload: {} });
      response.resolve();
      await act(async () => {
        await sending;
      });
      expect(result.current.isRunning).toBe(true);
      await emit({ type: 'thread-run-status', runId: 'newer-run', from: 'AGENT', payload: { status: 'success' } });
      await waitFor(() => expect(result.current.isRunning).toBe(false));
    } finally {
      response.resolve();
      await sending;
      unmount();
      controller?.close();
    }
  });
  it.each(['success', 'failed', 'aborted', 'suspended'] as const)(
    'stops the matching run on %s while ignoring historical outcomes',
    async status => {
      let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
      server.use(
        http.post(`${TEST_BASE_URL}/api/agents/agent-1/threads/subscribe`, async ({ request }) => {
          expect(await request.json()).toMatchObject({ withRunStatus: true });
          return new HttpResponse(
            new ReadableStream<Uint8Array>({
              start(value) {
                controller = value;
              },
            }),
            {
              headers: { 'content-type': 'text/event-stream' },
            },
          );
        }),
      );
      const { result, unmount } = renderHookWithProviders(() =>
        useChat({ agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1', enableThreadSignals: true }),
      );
      const emit = async (chunk: unknown) => {
        await act(async () => {
          controller?.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
        });
      };
      try {
        await waitFor(() => expect(controller).toBeDefined());
        await emit({ type: 'start', runId: 'current-run', from: 'AGENT', payload: {} });
        await waitFor(() => expect(result.current.isRunning).toBe(true));
        await emit({ type: 'thread-run-status', runId: 'old-run', from: 'AGENT', payload: { status } });
        expect(result.current.isRunning).toBe(true);
        await emit({ type: 'thread-run-status', runId: 'current-run', from: 'AGENT', payload: { status } });
        await waitFor(() => expect(result.current.isRunning).toBe(false));
        await emit({ type: 'start', runId: 'next-run', from: 'AGENT', payload: {} });
        await waitFor(() => expect(result.current.isRunning).toBe(true));
        await emit({
          type: 'tool-call-approval',
          runId: 'next-run',
          from: 'AGENT',
          payload: { toolCallId: 'approval-1', toolName: 'confirm', args: {} },
        });
        await waitFor(() => expect(result.current.isAwaitingToolApproval).toBe(true));
        await emit({ type: 'thread-run-status', runId: 'next-run', from: 'AGENT', payload: { status } });
        await waitFor(() => expect(result.current.isAwaitingToolApproval).toBe(status === 'suspended'));
        if (status === 'suspended') {
          await emit({
            type: 'tool-call-resumed',
            runId: 'next-run',
            from: 'AGENT',
            payload: { toolCallId: 'approval-1' },
          });
          await waitFor(() => expect(result.current.isAwaitingToolApproval).toBe(false));
          await emit({ type: 'start', runId: 'next-run', from: 'AGENT', payload: {} });
          await waitFor(() => expect(result.current.isRunning).toBe(true));
          await emit({ type: 'thread-run-status', runId: 'next-run', from: 'AGENT', payload: { status: 'success' } });
          await waitFor(() => expect(result.current.isRunning).toBe(false));
        }
      } finally {
        unmount();
        controller?.close();
      }
    },
  );
});
