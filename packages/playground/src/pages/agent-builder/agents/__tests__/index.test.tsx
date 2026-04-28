// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentBuilderAgentsPage from '..';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui', async () => {
  const actual = await vi.importActual<typeof PlaygroundUi>('@mastra/playground-ui');
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
    usePlaygroundStore: () => ({ requestContext: undefined }),
  };
});

let currentUser: { id: string } | undefined = { id: 'user-1' };
let isCurrentUserLoading = false;

vi.mock('@/domains/auth/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: currentUser, isLoading: isCurrentUserLoading }),
}));

const BASE_URL = 'http://localhost:4111';

const StubLink = ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a {...props}>{children}</a>
);

const noopPaths = {
  agentLink: () => '',
  agentMessageLink: () => '',
  workflowLink: () => '',
  toolLink: () => '',
  scoreLink: () => '',
  scorerLink: () => '',
  toolByAgentLink: () => '',
  toolByWorkflowLink: () => '',
  promptLink: () => '',
  legacyWorkflowLink: () => '',
  policyLink: () => '',
  vNextNetworkLink: () => '',
  agentBuilderLink: () => '',
  mcpServerLink: () => '',
  mcpServerToolLink: () => '',
  workflowRunLink: () => '',
  datasetLink: () => '',
  datasetItemLink: () => '',
  datasetExperimentLink: () => '',
  experimentLink: () => '',
} as never;

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink as never} navigate={() => {}} paths={noopPaths}>
          <AgentBuilderAgentsPage />
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

const baseAgent = {
  status: 'draft' as const,
  visibility: 'private' as const,
  instructions: '',
  model: { provider: 'openai', name: 'gpt-4' },
  authorId: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('AgentBuilderAgentsPage', () => {
  afterEach(() => {
    cleanup();
    currentUser = { id: 'user-1' };
    isCurrentUserLoading = false;
  });

  it('passes authorId to the API when the current user is available', async () => {
    const capturedSearches: URLSearchParams[] = [];
    server.use(
      http.get(`${BASE_URL}/api/stored/agents`, ({ request }) => {
        capturedSearches.push(new URL(request.url).searchParams);
        return HttpResponse.json({
          agents: [{ ...baseAgent, id: 'agent-1', name: 'My Agent', description: 'Personal draft' }],
          total: 1,
          page: 1,
          perPage: 100,
          hasMore: false,
        });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(capturedSearches).toHaveLength(1);
    });
    expect(capturedSearches[0].get('status')).toBeNull();
    expect(capturedSearches[0].get('authorId')).toBe('user-1');
    expect(capturedSearches[0].get('visibility')).toBeNull();
    expect(screen.queryByText('All agents')).toBeNull();
  });

  it('waits for the current user query before fetching agents', async () => {
    isCurrentUserLoading = true;
    let requestCount = 0;
    server.use(
      http.get(`${BASE_URL}/api/stored/agents`, () => {
        requestCount += 1;
        return HttpResponse.json({ agents: [], total: 0, page: 1, perPage: 100, hasMore: false });
      }),
    );

    renderPage();

    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(requestCount).toBe(0);
  });

  it('omits authorId when no current user is available', async () => {
    currentUser = undefined;
    let capturedSearch: URLSearchParams | null = null;
    server.use(
      http.get(`${BASE_URL}/api/stored/agents`, ({ request }) => {
        capturedSearch = new URL(request.url).searchParams;
        return HttpResponse.json({ agents: [], total: 0, page: 1, perPage: 100, hasMore: false });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(capturedSearch).not.toBeNull();
    });
    expect(capturedSearch!.get('status')).toBeNull();
    expect(capturedSearch!.get('authorId')).toBeNull();
    expect(capturedSearch!.get('visibility')).toBeNull();
  });
});
