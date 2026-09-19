import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  branchHistoryFromChild,
  branchHistoryOfRoot,
  branchingUnsupportedError,
  childBranchesOfSource,
  CHILD_THREAD_ID,
  noBranches,
  SOURCE_THREAD_ID,
} from '../../../../memory/hooks/__tests__/fixtures/thread-branches';
import { AgentMemoryBranches } from '../agent-memory-branches';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-branch';

const makeWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TestLinkProvider>{children}</TestLinkProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const useThreadLineage = ({
  historyThreadId,
  history,
  branchesThreadId,
  branches,
}: {
  historyThreadId: string;
  history: unknown;
  branchesThreadId: string;
  branches: unknown;
}) => {
  server.use(
    http.get(`${BASE_URL}/api/memory/threads/${historyThreadId}/branch-history`, () => HttpResponse.json(history)),
    http.get(`${BASE_URL}/api/memory/threads/${branchesThreadId}/branches`, () => HttpResponse.json(branches)),
  );
};

describe('AgentMemoryBranches', () => {
  afterEach(() => {
    cleanup();
  });

  describe('when the thread is a branch with a parent', () => {
    it('links back to the parent thread', async () => {
      useThreadLineage({
        historyThreadId: CHILD_THREAD_ID,
        history: branchHistoryFromChild,
        branchesThreadId: CHILD_THREAD_ID,
        branches: noBranches,
      });

      render(<AgentMemoryBranches agentId={AGENT_ID} threadId={CHILD_THREAD_ID} />, { wrapper: makeWrapper() });

      const parentLink = await screen.findByRole('link', { name: /Branched from/ });
      expect(parentLink.getAttribute('href')).toBe(`/agents/${AGENT_ID}/threads/${SOURCE_THREAD_ID}`);
      expect(parentLink.textContent).toContain('Source thread');
    });
  });

  describe('when the thread has child branches', () => {
    it('lists each branch with a link to it', async () => {
      useThreadLineage({
        historyThreadId: SOURCE_THREAD_ID,
        history: branchHistoryOfRoot,
        branchesThreadId: SOURCE_THREAD_ID,
        branches: childBranchesOfSource,
      });

      render(<AgentMemoryBranches agentId={AGENT_ID} threadId={SOURCE_THREAD_ID} />, { wrapper: makeWrapper() });

      const firstBranch = await screen.findByRole('link', { name: 'Child branch' });
      expect(firstBranch.getAttribute('href')).toBe(`/agents/${AGENT_ID}/threads/${CHILD_THREAD_ID}`);
      expect(screen.getByRole('link', { name: 'Second branch' }).getAttribute('href')).toBe(
        `/agents/${AGENT_ID}/threads/thread-branch-child-2`,
      );
    });
  });

  describe('when the thread has no lineage', () => {
    it('renders nothing', async () => {
      useThreadLineage({
        historyThreadId: SOURCE_THREAD_ID,
        history: branchHistoryOfRoot,
        branchesThreadId: SOURCE_THREAD_ID,
        branches: noBranches,
      });

      const { container } = render(<AgentMemoryBranches agentId={AGENT_ID} threadId={SOURCE_THREAD_ID} />, {
        wrapper: makeWrapper(),
      });

      await waitFor(() => {
        expect(screen.queryByText('Branches')).toBeNull();
      });
      expect(container.innerHTML).toBe('');
    });
  });

  describe('when memory does not support branching', () => {
    it('renders nothing', async () => {
      server.use(
        http.get(`${BASE_URL}/api/memory/threads/${SOURCE_THREAD_ID}/branch-history`, () =>
          HttpResponse.json(branchingUnsupportedError, { status: 501 }),
        ),
        http.get(`${BASE_URL}/api/memory/threads/${SOURCE_THREAD_ID}/branches`, () =>
          HttpResponse.json(branchingUnsupportedError, { status: 501 }),
        ),
      );

      const { container } = render(<AgentMemoryBranches agentId={AGENT_ID} threadId={SOURCE_THREAD_ID} />, {
        wrapper: makeWrapper(),
      });

      await waitFor(() => {
        expect(screen.queryByText('Branches')).toBeNull();
      });
      expect(container.innerHTML).toBe('');
    });
  });
});
