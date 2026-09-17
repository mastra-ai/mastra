// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { MastraReactProvider, useMastraClient } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { IDBObjectStore } from 'fake-indexeddb';
import { deleteDB } from 'idb';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLogout } from '../use-auth-actions';
import { logoutResponse } from './fixtures/logout';
import { createThreadDraftState } from '@/domains/conversation/context/thread-draft-state';
import { readThreadDraft, writeThreadDraft } from '@/domains/conversation/context/thread-draft-storage';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const mount = () => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return renderHook(() => ({ logout: useLogout(), client: useMastraClient() }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MastraReactProvider>
    ),
  });
};

afterEach(async () => {
  vi.restoreAllMocks();
  cleanup();
  await readThreadDraft('__drain__');
  await deleteDB('mastra-composer-drafts');
});

describe('Studio sign-out', () => {
  describe('when the user has a saved draft', () => {
    it('starts scoped cleanup while ending the session and allowing an external redirect', async () => {
      const { result } = mount();
      const { baseUrl, apiPrefix } = result.current.client.options;
      const key = JSON.stringify([baseUrl, apiPrefix, 'user', 'agent', 'new']);
      await writeThreadDraft(key, { text: 'Private draft', attachments: [] });
      const observedDrafts: string[] = [];
      server.use(
        http.post(`${BASE_URL}/api/auth/logout`, async () => {
          observedDrafts.push((await readThreadDraft(key)).text);
          return HttpResponse.json(logoutResponse);
        }),
      );
      let response;
      await act(async () => {
        response = await result.current.logout.mutateAsync({ userId: 'user' });
      });
      expect(observedDrafts).toEqual(['']);
      expect(response).toEqual(logoutResponse);
    });
  });

  describe('when browser storage is unavailable even without drafts', () => {
    it('completes server logout without requiring a storage recovery step', async () => {
      const { result } = mount();
      const logout = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/auth/logout`, () => {
          logout();
          return HttpResponse.json(logoutResponse);
        }),
      );
      vi.spyOn(indexedDB, 'open').mockImplementation(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });
      await act(async () => {
        await expect(result.current.logout.mutateAsync({ userId: 'user' })).resolves.toEqual(logoutResponse);
      });
      expect(logout).toHaveBeenCalledOnce();
    });
  });

  describe('when browser storage cannot be cleared', () => {
    it('cancels this tab’s pending writes without blocking server logout', async () => {
      const { result } = mount();
      const { baseUrl, apiPrefix } = result.current.client.options;
      const key = JSON.stringify([baseUrl, apiPrefix, 'user', 'agent', 'new']);
      await writeThreadDraft(key, { text: 'Keep until cleanup succeeds', attachments: [] });
      const draft = createThreadDraftState(key);
      const unsubscribe = draft.subscribe(() => {});
      await waitFor(() => expect(draft.getSnapshot().status.restoring).toBe(false));
      const logout = vi.fn();
      server.use(
        http.post(`${BASE_URL}/api/auth/logout`, () => {
          logout();
          return HttpResponse.json(logoutResponse);
        }),
      );
      const remove = vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementationOnce(() => {
        throw new DOMException('Blocked', 'SecurityError');
      });
      draft.updateDraft(previous => ({ ...previous, text: 'Pending edit' }));
      await act(async () => {
        await expect(result.current.logout.mutateAsync({ userId: 'user' })).resolves.toEqual(logoutResponse);
        await readThreadDraft('__drain__');
      });
      remove.mockRestore();
      expect(logout).toHaveBeenCalledOnce();
      expect(draft.getSnapshot().draft.text).toBe('');
      draft.updateDraft({ text: 'Stale edit', attachments: [] });
      expect(draft.getSnapshot().draft.text).toBe('');
      unsubscribe();
      expect((await readThreadDraft(key)).text).toBe('Keep until cleanup succeeds');
    });
  });
});
