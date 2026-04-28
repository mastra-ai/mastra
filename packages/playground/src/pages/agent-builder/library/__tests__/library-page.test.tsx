// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentBuilderLibraryPage from '..';
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
          <AgentBuilderLibraryPage />
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

const baseAgent = {
  status: 'draft' as const,
  visibility: 'public' as const,
  instructions: '',
  model: { provider: 'openai', name: 'gpt-4' },
  authorId: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('AgentBuilderLibraryPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('passes visibility=public to the API without a status filter', async () => {
    let capturedSearch: URLSearchParams | null = null;
    server.use(
      http.get(`${BASE_URL}/api/stored/agents`, ({ request }) => {
        capturedSearch = new URL(request.url).searchParams;
        return HttpResponse.json({
          agents: [
            { ...baseAgent, id: 'lib-1', name: 'Public Alpha', description: 'Alpha desc' },
            { ...baseAgent, id: 'lib-2', name: 'Public Beta', description: 'Beta desc' },
          ],
          total: 2,
          page: 1,
          perPage: 100,
          hasMore: false,
        });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(capturedSearch).not.toBeNull();
    });
    expect(capturedSearch!.get('visibility')).toBe('public');
    expect(capturedSearch!.get('status')).toBeNull();
  });

  it('renders rows from the response with view links', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/agents`, () =>
        HttpResponse.json({
          agents: [
            { ...baseAgent, id: 'lib-1', name: 'Public Alpha', description: 'Alpha desc' },
            { ...baseAgent, id: 'lib-2', name: 'Public Beta', description: 'Beta desc' },
          ],
          total: 2,
          page: 1,
          perPage: 100,
          hasMore: false,
        }),
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Public Alpha')).toBeTruthy();
    });
    expect(screen.getByText('Public Beta')).toBeTruthy();

    const rows = screen.getAllByTestId('library-agent-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].getAttribute('href')).toBe('/agent-builder/agents/lib-1/view');
    expect(rows[1].getAttribute('href')).toBe('/agent-builder/agents/lib-2/view');
  });

  it('shows the empty state when the API returns no agents', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/agents`, () =>
        HttpResponse.json({ agents: [], total: 0, page: 1, perPage: 100, hasMore: false }),
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No public agents yet')).toBeTruthy();
    });
    expect(screen.queryByTestId('library-agent-row')).toBeNull();
  });

  it('shows the error state when the API returns 500', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/agents`, () => HttpResponse.json({ message: 'boom' }, { status: 500 })),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load the library')).toBeTruthy();
    });
  });

  it('shows SessionExpired when the API returns 401', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/agents`, () => HttpResponse.json({ message: 'unauthorized' }, { status: 401 })),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('No public agents yet')).toBeNull();
    });
    // SessionExpired component renders "Session expired" copy by default
    await waitFor(() => {
      expect(screen.getByText(/session expired/i)).toBeTruthy();
    });
  });
});
