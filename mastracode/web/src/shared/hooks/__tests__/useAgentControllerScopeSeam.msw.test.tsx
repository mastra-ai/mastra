import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/web-ui/render';
import { useSetAgentControllerGoalMutation } from '../useAgentControllerGoalMutations';
import {
  useCloneAgentControllerThreadMutation,
  useCreateAgentControllerThreadMutation,
  useDeleteAgentControllerThreadMutation,
  useRenameAgentControllerThreadMutation,
  useSwitchAgentControllerThreadMutation,
} from '../useAgentControllerThreadMutations';
import { useAgentControllerThreads } from '../useAgentControllerThreads';

const controllerId = 'code';
const resourceId = 'resource-test';
const scope = '/sandbox/mastra';
const sessionUrl = `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${resourceId}`;

/**
 * Every hook that owns a session-scoped write MUST forward the session scope
 * on the wire. If the seam drops the scope, mutations land in one server-side
 * session while reads point at another — the "Failed to switch thread"
 * regression on `/new` (see PR history).
 */
// Post-rename: the hook seam field is `scope`, matching the SDK's
// `sessionScope` query param and the factory's `createAgentControllerClient`
// argument. Callers whose local variable is a project path pass it in as
// `scope: worktreeProjectPath` (see the app-level ChatSessionProvider).
const hookArgs = {
  agentControllerId: controllerId,
  resourceId,
  scope,
  baseUrl: TEST_BASE_URL,
  enabled: true,
};

describe('agent-controller hook seam forwards session scope on the wire', () => {
  it('createThread', async () => {
    let captured: string | null | undefined;
    server.use(
      http.get(sessionUrl, () => HttpResponse.json({ threadId: null })),
      http.post(`${sessionUrl}/threads`, ({ request }) => {
        captured = new URL(request.url).searchParams.get('sessionScope');
        return HttpResponse.json({ id: 't1', title: 'x', updatedAt: '2026-07-21T00:00:00.000Z' });
      }),
    );
    const { result, client } = renderHookWithProviders(() => useCreateAgentControllerThreadMutation(hookArgs));
    await act(async () => result.current.mutateAsync('x'));
    await waitForMutationsIdle(client);
    expect(captured).toBe(scope);
  });

  it('deleteThread', async () => {
    let captured: string | null | undefined;
    server.use(
      http.get(sessionUrl, () => HttpResponse.json({ threadId: null })),
      http.delete(`${sessionUrl}/threads/thread-one`, ({ request }) => {
        captured = new URL(request.url).searchParams.get('sessionScope');
        return HttpResponse.json({ ok: true });
      }),
    );
    const { result, client } = renderHookWithProviders(() => useDeleteAgentControllerThreadMutation(hookArgs));
    await act(async () => result.current.mutateAsync('thread-one'));
    await waitForMutationsIdle(client);
    expect(captured).toBe(scope);
  });

  it('renameThread', async () => {
    let captured: string | null | undefined;
    server.use(
      http.get(sessionUrl, () => HttpResponse.json({ threadId: null })),
      http.put(`${sessionUrl}/threads/thread-one`, ({ request }) => {
        captured = new URL(request.url).searchParams.get('sessionScope');
        return HttpResponse.json({ ok: true });
      }),
    );
    const { result, client } = renderHookWithProviders(() => useRenameAgentControllerThreadMutation(hookArgs));
    await act(async () => result.current.mutateAsync({ threadId: 'thread-one', title: 'Renamed' }));
    await waitForMutationsIdle(client);
    expect(captured).toBe(scope);
  });

  it('cloneThread', async () => {
    let captured: string | null | undefined;
    server.use(
      http.get(sessionUrl, () => HttpResponse.json({ threadId: null })),
      http.post(`${sessionUrl}/threads/clone`, ({ request }) => {
        captured = new URL(request.url).searchParams.get('sessionScope');
        return HttpResponse.json({ id: 'tclone', title: 'clone', updatedAt: '2026-07-21T00:00:00.000Z' });
      }),
    );
    const { result, client } = renderHookWithProviders(() => useCloneAgentControllerThreadMutation(hookArgs));
    await act(async () => result.current.mutateAsync({ sourceThreadId: 'thread-one' }));
    await waitForMutationsIdle(client);
    expect(captured).toBe(scope);
  });

  it('switchThread', async () => {
    let captured: string | null | undefined;
    server.use(
      http.get(sessionUrl, () => HttpResponse.json({ threadId: 'thread-one' })),
      http.post(`${sessionUrl}/thread`, ({ request }) => {
        captured = new URL(request.url).searchParams.get('sessionScope');
        return HttpResponse.json({ ok: true });
      }),
    );
    const { result, client } = renderHookWithProviders(() => useSwitchAgentControllerThreadMutation(hookArgs));
    await act(async () => result.current.mutateAsync('thread-one'));
    await waitForMutationsIdle(client);
    expect(captured).toBe(scope);
  });

  it('setGoal', async () => {
    let captured: string | null | undefined;
    server.use(
      http.get(sessionUrl, () => HttpResponse.json({ threadId: null })),
      http.post(`${sessionUrl}/goal`, ({ request }) => {
        captured = new URL(request.url).searchParams.get('sessionScope');
        return HttpResponse.json({ goal: { objective: 'x', status: 'active' } });
      }),
    );
    const { result, client } = renderHookWithProviders(() => useSetAgentControllerGoalMutation(hookArgs));
    await act(async () => result.current.mutateAsync('x'));
    await waitForMutationsIdle(client);
    expect(captured).toBe(scope);
  });

  it('createThread lands in the scoped list so /new can navigate to the new thread', async () => {
    const threadsByScope = new Map<string, Array<{ id: string; title: string; updatedAt: string }>>();
    threadsByScope.set(scope, []);
    server.use(
      http.get(sessionUrl, () => HttpResponse.json({ threadId: null })),
      http.get(`${sessionUrl}/threads`, ({ request }) => {
        const s = new URL(request.url).searchParams.get('sessionScope') ?? '';
        return HttpResponse.json({ threads: threadsByScope.get(s) ?? [] });
      }),
      http.post(`${sessionUrl}/threads`, ({ request }) => {
        const s = new URL(request.url).searchParams.get('sessionScope') ?? '';
        const bucket = threadsByScope.get(s) ?? [];
        const created = { id: 'thread-created', title: 'x', updatedAt: '2026-07-21T00:00:00.000Z' };
        threadsByScope.set(s, [created, ...bucket]);
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
