// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ENTITY_ID, entitiesResponse, topicsResponse } from '../../hooks/__tests__/fixtures/entity-learning';
import { SignalsOverviewPage } from '../signals-overview-page';

// `react-resizable-panels` throws under jsdom; stub to plain elements so the
// real first-party TopicsLayout renders.
vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Separator: () => null,
  usePanelRef: () => ({ current: null }),
}));

const PLATFORM_URL = 'https://platform.test';
const server = setupServer();

function renderOverview() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SignalsOverviewPage onSignalSelect={() => {}} />
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  delete (window as { MASTRA_CLOUD_API_ENDPOINT?: string }).MASTRA_CLOUD_API_ENDPOINT;
  delete (window as { MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT?: string }).MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT;
});

afterAll(() => server.close());

describe('SignalsOverviewPage', () => {
  it('renders a section per available signal with its real topics', async () => {
    window.MASTRA_CLOUD_API_ENDPOINT = PLATFORM_URL;
    server.use(
      http.get(`${PLATFORM_URL}/entity-learning/entities`, () => HttpResponse.json(entitiesResponse)),
      http.get(`${PLATFORM_URL}/entity-learning/entities/${ENTITY_ID}/topics`, () => HttpResponse.json(topicsResponse)),
    );

    renderOverview();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'sentiment' })).not.toBeNull());
    await waitFor(() => expect(screen.getAllByText('Neutral Curiosity').length).toBeGreaterThan(0));
  });

  it('shows an error state when entities fail to load', async () => {
    window.MASTRA_CLOUD_API_ENDPOINT = PLATFORM_URL;
    server.use(http.get(`${PLATFORM_URL}/entity-learning/entities`, () => new HttpResponse(null, { status: 500 })));

    renderOverview();

    await waitFor(() => expect(screen.getByText("Couldn't load signals")).not.toBeNull());
  });

  it('shows an empty state when the entity has no signals', async () => {
    window.MASTRA_CLOUD_API_ENDPOINT = PLATFORM_URL;
    server.use(
      http.get(`${PLATFORM_URL}/entity-learning/entities`, () =>
        HttpResponse.json({
          entities: [{ ...entitiesResponse.entities[0], availableSignals: [] }],
        }),
      ),
    );

    renderOverview();

    await waitFor(() => expect(screen.getByText('No signals yet')).not.toBeNull());
  });
});
