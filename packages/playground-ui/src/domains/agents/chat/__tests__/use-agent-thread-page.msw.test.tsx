// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { expect, it, vi } from 'vitest';
import { useAgentThreadPage } from '../use-agent-thread-page';
import { server } from '@/test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '@/test/render';

it('refreshes the user-scoped list after deleting the selected conversation', async () => {
  let deleted = false;
  server.use(
    http.get(`${TEST_BASE_URL}/api/memory/status`, () => HttpResponse.json({ result: true })),
    http.get(`${TEST_BASE_URL}/api/memory/threads`, () =>
      HttpResponse.json(
        deleted
          ? []
          : [
              {
                id: 'conversation',
                resourceId: 'signed-user',
                title: 'Saved chat',
                createdAt: '2026-11-17T00:00:00Z',
                updatedAt: '2026-11-17T00:00:00Z',
              },
            ],
      ),
    ),
    http.delete(`${TEST_BASE_URL}/api/memory/threads/conversation`, () => {
      deleted = true;
      return HttpResponse.json({ success: true });
    }),
  );
  const navigateToNewThread = vi.fn();
  const { result } = renderHookWithProviders(() =>
    useAgentThreadPage({
      agentId: 'support',
      resourceId: 'signed-user',
      threadId: 'conversation',
      draftScope: [TEST_BASE_URL, '/api', 'signed-user', 'support'],
      canPersistDraft: false,
      navigateToThread: vi.fn(),
      navigateToNewThread,
    }),
  );
  await waitFor(() => expect(result.current.threads).toHaveLength(1));
  await act(() => result.current.deleteThread('conversation'));
  await waitFor(() => expect(result.current.threads).toHaveLength(0));
  expect(navigateToNewThread).toHaveBeenCalledOnce();
});
