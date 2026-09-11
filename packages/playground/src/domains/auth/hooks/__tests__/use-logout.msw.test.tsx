// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { MastraReactProvider, useMastraClient } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { IDBObjectStore } from 'fake-indexeddb';
import { deleteDB } from 'idb';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLogout } from '../use-auth-actions';
import { logoutResponse } from './fixtures/logout';
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
    it('clears it before ending the session and allowing an external redirect', async () => {
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

  describe('when browser storage cannot be cleared', () => {
    it('reports the failure without ending the session or claiming cleanup succeeded', async () => {
      const { result } = mount();
      const { baseUrl, apiPrefix } = result.current.client.options;
      const key = JSON.stringify([baseUrl, apiPrefix, 'user', 'agent', 'new']);
      await writeThreadDraft(key, { text: 'Keep until cleanup succeeds', attachments: [] });
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
      await act(async () => {
        await expect(result.current.logout.mutateAsync({ userId: 'user' })).rejects.toThrow(
          'Sign-out was not completed',
        );
      });
      remove.mockRestore();
      expect(logout).not.toHaveBeenCalled();
      expect((await readThreadDraft(key)).text).toBe('Keep until cleanup succeeds');
    });
  });
});
