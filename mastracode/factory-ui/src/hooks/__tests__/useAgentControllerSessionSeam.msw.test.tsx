import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { useSetAgentControllerGoalMutation } from '../useAgentControllerGoalMutations';
import {
  useCreateAgentControllerThreadMutation,
  useSwitchAgentControllerThreadMutation,
} from '../useAgentControllerThreadMutations';
import { useAgentControllerThreads } from '../useAgentControllerThreads';

const controllerId = 'code';
const sessionId = 'session-test';
const sessionUrl = `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${sessionId}`;

/**
 * Every hook that owns a session write MUST address the same server-side
 * session as the reads. If a write lands in another session while reads point
 * at this one, `/new` fails to switch thread (see PR history). Sessions are
 * addressed by their id alone; no session scope travels on the wire.
 */
const hookArgs = {
  agentControllerId: controllerId,
  resourceId: sessionId,
  baseUrl: TEST_BASE_URL,
  enabled: true,
};

describe('agent-controller hook seam addresses the session by its id', () => {
  it('createThread', async () => {
    let captured: URL | undefined;
    server.use(
      http.get(sessionUrl, () => HttpResponse.json({ threadId: null })),
      http.post(`${sessionUrl}/threads`, ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ id: 't1', title: 'x', updatedAt: '2026-07-21T00:00:00.000Z' });
      }),
    );
    const { result, client } = renderHookWithProviders(() => useCreateAgentControllerThreadMutation(hookArgs));
    await act(async () => result.current.mutateAsync('x'));
    await waitForMutationsIdle(client);
    expect(captured?.pathname).toContain(`/sessions/${sessionId}/`);
    expect(captured?.searchParams.has('sessionScope')).toBe(false);
  });

  it('switchThread', async () => {
    let captured: URL | undefined;
    server.use(
      http.get(sessionUrl, () => HttpResponse.json({ threadId: 'thread-one' })),
      http.post(`${sessionUrl}/thread`, ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ ok: true });
      }),
    );
    const { result, client } = renderHookWithProviders(() => useSwitchAgentControllerThreadMutation(hookArgs));
    await act(async () => result.current.mutateAsync('thread-one'));
    await waitForMutationsIdle(client);
    expect(captured?.pathname).toContain(`/sessions/${sessionId}/`);
    expect(captured?.searchParams.has('sessionScope')).toBe(false);
  });

  it('setGoal', async () => {
    let captured: URL | undefined;
    server.use(
      http.get(sessionUrl, () => HttpResponse.json({ threadId: null })),
      http.post(`${sessionUrl}/goal`, ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ goal: { objective: 'x', status: 'active' } });
      }),
    );
    const { result, client } = renderHookWithProviders(() => useSetAgentControllerGoalMutation(hookArgs));
    await act(async () => result.current.mutateAsync('x'));
    await waitForMutationsIdle(client);
    expect(captured?.pathname).toContain(`/sessions/${sessionId}/`);
    expect(captured?.searchParams.has('sessionScope')).toBe(false);
  });

  it('createThread lands in the session thread list so /new can navigate to the new thread', async () => {
    const threads: Array<{ id: string; title: string; updatedAt: string }> = [];
    server.use(
      http.get(sessionUrl, () => HttpResponse.json({ threadId: null })),
      http.get(`${sessionUrl}/threads`, () => HttpResponse.json({ threads })),
      http.post(`${sessionUrl}/threads`, () => {
        const created = { id: 'thread-created', title: 'x', updatedAt: '2026-07-21T00:00:00.000Z' };
        threads.unshift(created);
        return HttpResponse.json(created);
      }),
    );

    const { result, client } = renderHookWithProviders(() => ({
      list: useAgentControllerThreads(hookArgs),
      create: useCreateAgentControllerThreadMutation(hookArgs),
    }));

    await waitFor(() => expect(result.current.list.data).toEqual([]));
    await act(async () => result.current.create.mutateAsync('x'));
    await waitForMutationsIdle(client);
    await waitFor(() => expect(result.current.list.data?.map(t => t.id)).toEqual(['thread-created']));
  });
});
