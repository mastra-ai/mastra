import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useBranchThread, useThreadBranches } from '../use-memory';
import {
  branchCreatedResponse,
  branchHistoryFromChild,
  branchHistoryOfRoot,
  branchThreadNotFoundError,
  branchingUnsupportedError,
  childBranchesOfSource,
  CHILD_THREAD_ID,
  FORK_MESSAGE_ID,
  noBranches,
  SOURCE_THREAD_ID,
} from './fixtures/thread-branches';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-branch';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('useThreadBranches', () => {
  afterEach(() => {
    cleanup();
  });

  describe('when the current thread is a branch', () => {
    it('returns the parent thread and own fork metadata', async () => {
      server.use(
        http.get(`${BASE_URL}/api/memory/threads/${CHILD_THREAD_ID}/branch-history`, () =>
          HttpResponse.json(branchHistoryFromChild),
        ),
        http.get(`${BASE_URL}/api/memory/threads/${CHILD_THREAD_ID}/branches`, () => HttpResponse.json(noBranches)),
      );

      const { result } = renderHook(() => useThreadBranches({ threadId: CHILD_THREAD_ID, agentId: AGENT_ID }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data?.isSupported).toBe(true);
      });
      expect(result.current.data?.parentThread?.id).toBe(SOURCE_THREAD_ID);
      expect(result.current.data?.fork?.branchPointMessageId).toBe(FORK_MESSAGE_ID);
    });
  });

  describe('when the current thread is a root with child branches', () => {
    it('returns the direct children with their fork points', async () => {
      server.use(
        http.get(`${BASE_URL}/api/memory/threads/${SOURCE_THREAD_ID}/branch-history`, () =>
          HttpResponse.json(branchHistoryOfRoot),
        ),
        http.get(`${BASE_URL}/api/memory/threads/${SOURCE_THREAD_ID}/branches`, () =>
          HttpResponse.json(childBranchesOfSource),
        ),
      );

      const { result } = renderHook(() => useThreadBranches({ threadId: SOURCE_THREAD_ID, agentId: AGENT_ID }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data?.branches).toHaveLength(2);
      });
      expect(result.current.data?.parentThread).toBeNull();
      expect(result.current.data?.fork).toBeNull();
      expect(result.current.data?.branches[0]?.branch.branchPointMessageId).toBe(FORK_MESSAGE_ID);
    });
  });

  describe('when memory does not support branching', () => {
    it('reports branching as unsupported instead of surfacing an error', async () => {
      server.use(
        http.get(`${BASE_URL}/api/memory/threads/${SOURCE_THREAD_ID}/branch-history`, () =>
          HttpResponse.json(branchingUnsupportedError, { status: 501 }),
        ),
        http.get(`${BASE_URL}/api/memory/threads/${SOURCE_THREAD_ID}/branches`, () =>
          HttpResponse.json(branchingUnsupportedError, { status: 501 }),
        ),
      );

      const { result } = renderHook(() => useThreadBranches({ threadId: SOURCE_THREAD_ID, agentId: AGENT_ID }), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => {
        expect(result.current.data?.isSupported).toBe(false);
      });
      expect(result.current.error).toBeNull();
      expect(result.current.data?.branches).toEqual([]);
    });
  });

  describe('when the thread row is not persisted yet right after the first message', () => {
    it('retries the not-found window and returns lineage once the row exists', async () => {
      let historyCalls = 0;
      server.use(
        http.get(`${BASE_URL}/api/memory/threads/${SOURCE_THREAD_ID}/branch-history`, () => {
          historyCalls += 1;
          if (historyCalls === 1) return HttpResponse.json(branchThreadNotFoundError, { status: 404 });
          return HttpResponse.json(branchHistoryOfRoot);
        }),
        http.get(`${BASE_URL}/api/memory/threads/${SOURCE_THREAD_ID}/branches`, () =>
          HttpResponse.json(childBranchesOfSource),
        ),
      );

      const { result } = renderHook(() => useThreadBranches({ threadId: SOURCE_THREAD_ID, agentId: AGENT_ID }), {
        wrapper: makeWrapper(),
      });

      await waitFor(
        () => {
          expect(result.current.data?.branches).toHaveLength(2);
        },
        { timeout: 10_000 },
      );
      expect(historyCalls).toBeGreaterThan(1);
    });
  });

  describe('when there is no saved thread', () => {
    it('does not request lineage for the new-chat placeholder', () => {
      const onRequest = vi.fn();
      server.use(
        http.get(`${BASE_URL}/api/memory/threads/:threadId/branch-history`, () => {
          onRequest();
          return HttpResponse.json(branchHistoryOfRoot);
        }),
      );

      renderHook(() => useThreadBranches({ threadId: 'new', agentId: AGENT_ID }), { wrapper: makeWrapper() });

      expect(onRequest).not.toHaveBeenCalled();
    });
  });
});

describe('useBranchThread', () => {
  afterEach(() => {
    cleanup();
  });

  describe('when branching from a fork message', () => {
    it('posts the fork point to the branch route and returns the child thread', async () => {
      const onBranch = vi.fn<(body: unknown) => void>();
      server.use(
        http.post(`${BASE_URL}/api/memory/threads/${SOURCE_THREAD_ID}/branch`, async ({ request }) => {
          onBranch(await request.json());
          return HttpResponse.json(branchCreatedResponse);
        }),
      );

      const { result } = renderHook(() => useBranchThread(), { wrapper: makeWrapper() });
      const response = await result.current.mutateAsync({
        threadId: SOURCE_THREAD_ID,
        agentId: AGENT_ID,
        branchPointMessageId: FORK_MESSAGE_ID,
      });

      expect(onBranch).toHaveBeenCalledWith({ branchPointMessageId: FORK_MESSAGE_ID });
      expect(response.thread.id).toBe(CHILD_THREAD_ID);
    });
  });
});
