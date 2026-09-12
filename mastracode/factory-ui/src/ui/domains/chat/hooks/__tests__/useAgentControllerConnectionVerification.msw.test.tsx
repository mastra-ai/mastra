import type { AgentControllerEvent } from '@mastra/client-js';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import assert from 'node:assert';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { useAgentControllerConnection } from '../useAgentControllerConnection';

const controllerId = 'code';
const resourceId = 'verification-resource';
const threadId = 'thread-a';
const sessionUrl = `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${resourceId}`;

describe('session thread verification', () => {
  it('suppresses foreign raw events after a failed verification until a scoped read confirms ownership', async () => {
    const onEvent = vi.fn();
    const encoder = new TextEncoder();
    let emit: ((event: AgentControllerEvent) => void) | undefined;
    let stateReads = 0;
    const tasks = [{ id: 'a', content: 'Task from A', status: 'pending', activeForm: 'Working on A' }];
    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions`, () =>
        HttpResponse.json({ controllerId, resourceId, threadId }),
      ),
      http.get(sessionUrl, ({ request }) => {
        expect(new URL(request.url).searchParams.get('threadId')).toBe(threadId);
        stateReads += 1;
        if (stateReads === 2) return HttpResponse.json({ error: 'Storage unavailable' }, { status: 500 });
        return HttpResponse.json({ controllerId, resourceId, threadId, tasks });
      }),
      http.get(
        `${sessionUrl}/stream`,
        () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                emit = event => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              },
              cancel() {},
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          ),
      ),
    );

    const { result } = renderHookWithProviders(() =>
      useAgentControllerConnection({
        agentControllerId: controllerId,
        resourceId,
        sessionThreadId: threadId,
        baseUrl: TEST_BASE_URL,
        onEvent,
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    assert(emit);
    emit({ type: 'thread_changed', threadId: 'thread-b', previousThreadId: threadId });
    await waitFor(() => expect(stateReads).toBe(2));
    await waitFor(() => expect(result.current.status).toBe('reconnecting'));

    await act(async () => {
      assert(emit);
      emit({
        type: 'task_updated',
        tasks: [{ id: 'foreign', content: 'Foreign task', status: 'pending', activeForm: 'Working elsewhere' }],
      });
      emit({ type: 'info', message: 'Foreign receipt' });
    });
    await waitFor(() => expect(result.current.status).toBe('ready'), { timeout: 4000 });
    assert(emit);
    const ownedReceipt: AgentControllerEvent = { type: 'info', message: 'Owned receipt after verification' };
    emit(ownedReceipt);
    await waitFor(() => expect(onEvent).toHaveBeenCalledWith(ownedReceipt));

    expect(onEvent.mock.calls).toEqual([[ownedReceipt]]);
    expect(result.current.state?.tasks).toEqual(tasks);
  });

  it('does not trust an older successful read after another thread change arrives', async () => {
    const encoder = new TextEncoder();
    let emit: ((event: AgentControllerEvent) => void) | undefined;
    let stateReads = 0;
    let releaseStaleRead: (() => void) | undefined;
    const staleReadGate = new Promise<void>(resolve => {
      releaseStaleRead = resolve;
    });
    server.use(
      http.post(`${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions`, () =>
        HttpResponse.json({ controllerId, resourceId, threadId }),
      ),
      http.get(sessionUrl, async () => {
        stateReads += 1;
        if (stateReads >= 3) return HttpResponse.json({ error: 'Session moved again' }, { status: 409 });
        if (stateReads === 2) await staleReadGate;
        return HttpResponse.json({ controllerId, resourceId, threadId });
      }),
      http.get(
        `${sessionUrl}/stream`,
        () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                emit = event => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              },
              cancel() {},
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          ),
      ),
    );

    const { result } = renderHookWithProviders(() =>
      useAgentControllerConnection({
        agentControllerId: controllerId,
        resourceId,
        sessionThreadId: threadId,
        baseUrl: TEST_BASE_URL,
        onEvent: vi.fn(),
      }),
    );
    try {
      await waitFor(() => expect(result.current.status).toBe('ready'));
      assert(emit);
      emit({ type: 'thread_changed', threadId: 'thread-b', previousThreadId: threadId });
      await waitFor(() => expect(stateReads).toBe(2));

      emit({ type: 'thread_changed', threadId: 'thread-c', previousThreadId: 'thread-b' });
      releaseStaleRead?.();
      await waitFor(() => expect(result.current.status).toBe('conflict'));
      expect(result.current.state).toBeUndefined();
      expect(result.current.threadId).toBe(threadId);
    } finally {
      releaseStaleRead?.();
    }
  });
});
