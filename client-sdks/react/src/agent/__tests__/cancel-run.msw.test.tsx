// @vitest-environment jsdom
import type { StreamParams } from '@mastra/client-js';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../test/render';
import { useChat } from '../hooks';

// Durable execution outlives the streaming request. Stop must send an explicit
// cancellation request, using the run ID rather than cancelling a newer turn.
describe.each([undefined, 'thread-1'])('useChat Stop with thread %s (COR-1489)', threadId => {
  it('keeps cancelling when the observer ends without acknowledgement', async () => {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    let sending: Promise<void> | undefined;
    let abortAttempts = 0;
    server.use(
      http.post<never, StreamParams>(`${TEST_BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
        const { runId } = await request.json();
        return new HttpResponse(
          new ReadableStream<Uint8Array>({
            start(stream) {
              controller = stream;
              stream.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify({ type: 'start', runId, payload: {} })}\n\n`),
              );
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } },
        );
      }),
      http.post(`${TEST_BASE_URL}/api/agents/agent-1/${threadId ? 'threads/abort' : 'runs/:runId/abort'}`, async () => {
        abortAttempts++;
        if (abortAttempts === 1) {
          controller?.close();
          await sending;
        }
        return HttpResponse.json({ aborted: abortAttempts > 1 });
      }),
    );
    const { result } = renderHookWithProviders(() =>
      useChat({ agentId: 'agent-1', resourceId: 'resource-1', threadId }),
    );
    act(() => {
      sending = result.current.sendMessage({ message: 'Complete while stopping', threadId });
    });
    await waitFor(() => expect(controller).toBeDefined());
    await act(async () => {
      await result.current.cancelRun();
    });
    expect(abortAttempts).toBe(2);
    expect(result.current.isRunning).toBe(false);
  });

  it.each([false, true])(
    'explicitly cancels the active run with delayed registration=%s',
    async delayedRegistration => {
      const registration = Promise.withResolvers<void>();
      let abortAttempts = 0;
      let runId: string | undefined;
      let cancelledRunId: string | undefined;
      let abortBody: unknown;
      let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
      server.use(
        http.post<never, StreamParams>(`${TEST_BASE_URL}/api/agents/agent-1/stream`, async ({ request }) => {
          runId = (await request.json()).runId;
          if (delayedRegistration) await registration.promise;
          return new HttpResponse(
            new ReadableStream<Uint8Array>({
              start(stream) {
                controller = stream;
                stream.enqueue(
                  new TextEncoder().encode(`data: ${JSON.stringify({ type: 'start', runId, payload: {} })}\n\n`),
                );
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          );
        }),
        http.post(`${TEST_BASE_URL}/api/agents/agent-1/threads/abort`, async ({ request }) => {
          abortBody = await request.json();
          abortAttempts++;
          if (delayedRegistration && abortAttempts === 1) {
            registration.resolve();
            return HttpResponse.json({ aborted: false });
          }
          if (
            typeof abortBody === 'object' &&
            abortBody &&
            'expectedRunId' in abortBody &&
            typeof abortBody.expectedRunId === 'string'
          ) {
            cancelledRunId = abortBody.expectedRunId;
          }
          return HttpResponse.json({ aborted: true });
        }),
        http.post(`${TEST_BASE_URL}/api/agents/agent-1/runs/:runId/abort`, ({ params }) => {
          abortAttempts++;
          if (delayedRegistration && abortAttempts === 1) {
            registration.resolve();
            return HttpResponse.json({ aborted: false });
          }
          if (typeof params.runId === 'string') cancelledRunId = params.runId;
          return HttpResponse.json({ aborted: true });
        }),
      );
      const { result } = renderHookWithProviders(() =>
        useChat({ agentId: 'agent-1', resourceId: 'resource-1', threadId }),
      );
      let sending: Promise<void> | undefined;
      try {
        act(() => {
          sending = result.current.sendMessage({ message: 'Run the slow tool', threadId }).catch(error => {
            if (!(error instanceof Error) || error.name !== 'AbortError') throw error;
          });
        });
        await waitFor(() => expect(runId).toBeTruthy());
        // Delayed registration intentionally leaves the HTTP response headers pending.
        await waitFor(() => expect(result.current.isRunning).toBe(true));
        await act(async () => {
          await result.current.cancelRun();
        });
        await waitFor(() => expect(cancelledRunId).toBe(runId));
        expect(abortAttempts).toBe(delayedRegistration ? 2 : 1);
        if (threadId) expect(abortBody).toEqual({ threadId, resourceId: 'resource-1', expectedRunId: runId });
        expect(result.current.isRunning).toBe(false);
      } finally {
        try {
          controller?.close();
        } catch {
          /* The cancelled HTTP reader may already be closed. */
        }
        await sending?.catch(() => {});
      }
    },
  );
});
