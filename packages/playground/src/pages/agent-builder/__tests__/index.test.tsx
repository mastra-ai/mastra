import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentBuilderRoot } from '../index';
import { emptyStoredAgents, oneDraftAgent, onePublishedAgent } from './fixtures/stored-agents';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui/components/Spinner', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock('react-router', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  };
});

const BASE_URL = 'http://localhost:4111';

const renderRoot = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AgentBuilderRoot />
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const pendingResolvers: Array<() => void> = [];

afterEach(() => {
  cleanup();
  while (pendingResolvers.length) pendingResolvers.pop()?.();
});

const deferred = () => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  pendingResolvers.push(resolve);
  return { promise, resolve };
};

describe('AgentBuilderRoot', () => {
  it('renders a spinner while the stored-agents requests are pending', async () => {
    const gate = deferred();
    server.use(
      http.get(`${BASE_URL}/api/stored/agents`, async () => {
        await gate.promise;
        return HttpResponse.json(emptyStoredAgents);
      }),
    );

    renderRoot();

    expect(screen.getByTestId('spinner')).not.toBeNull();
    expect(screen.queryByTestId('navigate')).toBeNull();

    gate.resolve();
    await waitFor(() => expect(screen.queryByTestId('spinner')).toBeNull());
  });

  it('navigates to the create page when both stored-agents lists are empty', async () => {
    server.use(http.get(`${BASE_URL}/api/stored/agents`, () => HttpResponse.json(emptyStoredAgents)));

    renderRoot();

    const navigate = await screen.findByTestId('navigate');
    expect(navigate.getAttribute('data-to')).toBe('/agent-builder/agents/create');
    expect(screen.queryByTestId('spinner')).toBeNull();
  });

  it('navigates to the agents list when at least one draft agent exists', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/agents`, ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        return HttpResponse.json(status === 'draft' ? oneDraftAgent : emptyStoredAgents);
      }),
    );

    renderRoot();

    const navigate = await screen.findByTestId('navigate');
    expect(navigate.getAttribute('data-to')).toBe('/agent-builder/agents');
  });

  it('navigates to the agents list when at least one published agent exists', async () => {
    server.use(
      http.get(`${BASE_URL}/api/stored/agents`, ({ request }) => {
        const status = new URL(request.url).searchParams.get('status');
        return HttpResponse.json(status === 'published' ? onePublishedAgent : emptyStoredAgents);
      }),
    );

    renderRoot();

    const navigate = await screen.findByTestId('navigate');
    expect(navigate.getAttribute('data-to')).toBe('/agent-builder/agents');
  });
});
