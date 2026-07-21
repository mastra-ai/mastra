import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { useAvailableModelsQuery } from '../useAvailableModels';
import { useAgentControllerThreadMessages } from '../useAgentControllerThreadMessages';
import { AGENT_CONTROLLER_THREAD_PAGE_SIZE, useAgentControllerThreads } from '../useAgentControllerThreads';

const controllerId = 'code';
const resourceId = 'resource-test';
const sessionUrl = `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${resourceId}`;
const hookArgs = { agentControllerId: controllerId, resourceId, baseUrl: TEST_BASE_URL, enabled: true };

describe('agent-controller read hooks', () => {
  it('loads the session-independent model catalog from the config endpoint', async () => {
    const onReadModels = vi.fn();

    server.use(
      http.get(`${TEST_BASE_URL}/web/config/models`, () => {
        onReadModels();
        return HttpResponse.json({
          models: [{ id: 'openai/gpt-4.1', provider: 'openai', modelName: 'gpt-4.1', hasApiKey: true }],
        });
      }),
    );

    const { result } = renderHookWithProviders(() => useAvailableModelsQuery());

    await waitFor(() => expect(result.current.data?.map(model => model.id)).toEqual(['openai/gpt-4.1']));
    expect(onReadModels).toHaveBeenCalledTimes(1);
  });

  it('scopes the thread list request to the active factory path and sidebar page size', async () => {
    const onReadThreads = vi.fn();

    server.use(
      http.get(`${sessionUrl}/threads`, ({ request }) => {
        const url = new URL(request.url);
        onReadThreads({ limit: url.searchParams.get('limit'), tags: url.searchParams.get('tags') });
        return HttpResponse.json({
          threads: [{ id: 'thread-one', title: 'Thread one', updatedAt: '2026-07-07T00:00:00.000Z' }],
        });
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useAgentControllerThreads({ ...hookArgs, scope: '/sandbox/mastra' }),
    );

    await waitFor(() => expect(result.current.data?.[0]?.id).toBe('thread-one'));
    expect(onReadThreads).toHaveBeenCalledWith({
      limit: String(AGENT_CONTROLLER_THREAD_PAGE_SIZE),
      tags: JSON.stringify({ projectPath: '/sandbox/mastra' }),
    });
  });

  it('keeps persisted thread messages from refetching on window focus', async () => {
    const onReadMessages = vi.fn();

    server.use(
      http.get(`${sessionUrl}/threads/thread-one/messages`, () => {
        onReadMessages();
        return HttpResponse.json({
          messages: [{ id: 'message-one', role: 'assistant', content: 'Persisted reply' }],
        });
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useAgentControllerThreadMessages({ ...hookArgs, threadId: 'thread-one' }),
    );

    await waitFor(() => expect(result.current.data?.[0]?.id).toBe('message-one'));

    window.dispatchEvent(new Event('focus'));
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(onReadMessages).toHaveBeenCalledTimes(1);
  });

  it('grows the fetch window on loadMore and stops when the top is reached', async () => {
    // Thread has 3 messages total. The endpoint honors ?limit= by returning the
    // newest N (oldest-first), which is how the real server behaves.
    const all = [
      { id: 'm1', role: 'assistant', content: 'one' },
      { id: 'm2', role: 'assistant', content: 'two' },
      { id: 'm3', role: 'assistant', content: 'three' },
    ];
    const seenLimits: number[] = [];

    server.use(
      http.get(`${sessionUrl}/threads/thread-one/messages`, ({ request }) => {
        const limit = Number(new URL(request.url).searchParams.get('limit'));
        seenLimits.push(limit);
        return HttpResponse.json({ messages: all.slice(Math.max(0, all.length - limit)) });
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useAgentControllerThreadMessages({ ...hookArgs, threadId: 'thread-one', initialLimit: 2, pageSize: 2 }),
    );

    // First window: newest 2 of 3 -> a full page, so more history may exist.
    await waitFor(() => expect(result.current.data?.map(m => m.id)).toEqual(['m2', 'm3']));
    expect(result.current.hasMore).toBe(true);
    expect(seenLimits).toEqual([2]);

    // Grow the window: fetch newest 4 -> only 3 exist -> short page -> top reached.
    act(() => result.current.loadMore());

    // The previous window stays on screen while the larger one loads (no blank
    // skeleton / remount): data is never cleared to undefined during the grow.
    expect(result.current.data).toBeDefined();
    expect(result.current.isPending).toBe(false);

    await waitFor(() => expect(result.current.data?.map(m => m.id)).toEqual(['m1', 'm2', 'm3']));
    expect(result.current.hasMore).toBe(false);
    expect(seenLimits).toEqual([2, 4]);
  });

  it("does not carry a previous thread's messages when switching threads", async () => {
    server.use(
      http.get(`${sessionUrl}/threads/:threadId/messages`, ({ params }) => {
        const id = params.threadId as string;
        return HttpResponse.json({ messages: [{ id: `${id}-msg`, role: 'assistant', content: id }] });
      }),
    );

    const { result, rerender } = renderHookWithProviders(
      ({ threadId }: { threadId: string }) => useAgentControllerThreadMessages({ ...hookArgs, threadId }),
      { initialProps: { threadId: 'thread-a' } },
    );

    await waitFor(() => expect(result.current.data?.[0]?.id).toBe('thread-a-msg'));

    rerender({ threadId: 'thread-b' });

    // Switching threads is a real pending state — the old thread's data must not
    // leak in via placeholderData.
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.[0]?.id).toBe('thread-b-msg'));
  });
});
