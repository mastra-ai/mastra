import type { BuilderAvailableModelsResponse, BuilderSettingsResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentBuilderAgentsPage from '..';
import type { AuthCapabilities } from '@/domains/auth/types';
import { LinkComponentProvider } from '@/lib/framework';
import { server } from '@/test/msw-server';

const builderEnabled: BuilderSettingsResponse = {
  enabled: true,
  features: { agent: {} },
};

const emptyAvailableModels: BuilderAvailableModelsResponse = {
  providers: [],
};

const unauthenticatedCapabilities = {
  enabled: true,
  login: { type: 'credentials' as const },
} satisfies AuthCapabilities;
vi.mock('@mastra/playground-ui/store/playground-store', () => ({
  usePlaygroundStore: () => ({ requestContext: undefined }),
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

function userHandler(user: { id: string } | null) {
  return [
    http.get(`${BASE_URL}/api/auth/me`, () => {
      if (user === null) {
        return HttpResponse.json(null, { status: 401 });
      }
      return HttpResponse.json(user);
    }),
    http.post(`${BASE_URL}/api/auth/refresh`, () => HttpResponse.json(null, { status: 401 })),
  ];
}

function pendingUserHandler() {
  return http.get(`${BASE_URL}/api/auth/me`, () => {
    // Never resolves; the query stays in the loading state.
    return new Promise<Response>(() => {});
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LinkComponentProvider Link={StubLink as never} navigate={() => {}} paths={noopPaths}>
            <AgentBuilderAgentsPage />
          </LinkComponentProvider>
        </TooltipProvider>
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

function defaultHandlers(onAvailableModels?: () => void) {
  return [
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(unauthenticatedCapabilities)),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(builderEnabled)),
    http.get(`${BASE_URL}/api/editor/builder/models/available`, () => {
      onAvailableModels?.();
      return HttpResponse.json(emptyAvailableModels);
    }),
  ];
}

afterEach(() => {
  cleanup();
});

describe('AgentBuilderAgentsPage', () => {
  it('passes authorId to the API when the current user is available', async () => {
    const capturedSearches: URLSearchParams[] = [];
    server.use(
      ...defaultHandlers(),
      ...userHandler({ id: 'user-1' }),
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
    let requestCount = 0;
    server.use(
      ...defaultHandlers(),
      pendingUserHandler(),
      http.get(`${BASE_URL}/api/stored/agents`, () => {
        requestCount += 1;
        return HttpResponse.json({ agents: [], total: 0, page: 1, perPage: 100, hasMore: false });
      }),
    );

    renderPage();

    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(requestCount).toBe(0);
  });

  it('renders the skeleton (not the empty state) while the current user is loading', async () => {
    server.use(
      ...defaultHandlers(),
      pendingUserHandler(),
      http.get(`${BASE_URL}/api/stored/agents`, () => {
        return HttpResponse.json({ agents: [], total: 0, page: 1, perPage: 100, hasMore: false });
      }),
    );

    renderPage();

    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(screen.queryByText('No agents yet')).toBeNull();
    expect(screen.queryByText('Create an agent')).toBeNull();
  });

  it('renders the resolved author name returned by the API in each row', async () => {
    server.use(
      ...defaultHandlers(),
      ...userHandler({ id: 'user-1' }),
      http.get(`${BASE_URL}/api/stored/agents`, () => {
        return HttpResponse.json({
          agents: [
            {
              ...baseAgent,
              id: 'agent-1',
              name: 'Alpha',
              description: 'd1',
              authorId: 'user-1',
              author: { id: 'user-1', name: 'Alice Doe' },
            },
            {
              ...baseAgent,
              id: 'agent-2',
              name: 'Beta',
              description: 'd2',
              authorId: 'user-2',
              author: { id: 'user-2', email: 'bob@example.com' },
            },
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
      expect(screen.getByText('Alpha')).toBeTruthy();
      expect(screen.getByText('Beta')).toBeTruthy();
    });

    expect(screen.getAllByText('Alice Doe').length).toBeGreaterThan(0);
    expect(screen.getAllByText('bob@example.com').length).toBeGreaterThan(0);
  });

  it('seeds the builder-available-models cache so the model picker is warm on the create/edit page', async () => {
    const onAvailableModels = vi.fn<() => void>();
    server.use(
      ...defaultHandlers(onAvailableModels),
      ...userHandler({ id: 'user-1' }),
      http.get(`${BASE_URL}/api/stored/agents`, () =>
        HttpResponse.json({ agents: [], total: 0, page: 1, perPage: 100, hasMore: false }),
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(onAvailableModels).toHaveBeenCalledTimes(1);
    });
  });

  it('omits authorId when no current user is available', async () => {
    let capturedSearch: URLSearchParams | null = null;
    server.use(
      ...defaultHandlers(),
      ...userHandler(null),
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
