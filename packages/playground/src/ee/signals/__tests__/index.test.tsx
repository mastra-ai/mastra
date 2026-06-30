// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SignalsOverviewPage, { SignalDetailsPage, SignalTraceIdPage } from '..';
import { SignalCrumb, SignalsRootCrumb } from '../signal-crumb';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const OBSERVABILITY_ENDPOINT = 'https://observability.test';
const ENTITY_LEARNING_ROOT = `${OBSERVABILITY_ENDPOINT}/entity-learning`;

type EntityLearningWindow = typeof globalThis & {
  MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT?: string;
};
const w = window as EntityLearningWindow;

// `react-resizable-panels` drives layout through a ResizeObserver-backed group
// controller that throws under jsdom. It is a third-party DOM boundary, so we
// stub it to plain elements and keep every first-party component (the route
// adapters, the overview page, the details page, the trace panel) real per the
// package testing rules — our own hooks/services/components are never mocked.
vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Separator: () => null,
  usePanelRef: () => ({ current: null }),
}));

// The overview page lists entities and the topics (clusters) of the selected
// entity. `entity_support` exposes the `sentiment` and `behavior` signals.
const entitiesResponse = {
  entities: [
    {
      organizationId: 'org-1',
      projectId: 'proj-1',
      entityType: 'agent',
      entityId: 'entity_support',
      availableSignals: ['sentiment'],
      latestRunId: '32',
      latestRunAt: '2026-06-29T00:00:00.000Z',
      runCount: 1,
      topicCount: 1,
      sourceItemCount: 10,
      groupedItemCount: 9,
      outlierItemCount: 1,
    },
  ],
};

const topicsResponse = {
  run: {
    runId: '32',
    signalName: 'sentiment',
    topicCount: 1,
    sourceItemCount: 10,
    groupedItemCount: 9,
    outlierItemCount: 1,
  },
  topics: [
    {
      topicId: '89',
      runId: '32',
      signalName: 'sentiment',
      name: 'Frustrated escalations',
      description: 'Users expressing frustration before escalating.',
      itemCount: 9,
      coverage: 0.9,
      score: 0.9,
    },
  ],
};

const topicExamplesResponse = {
  runId: '32',
  examples: [
    {
      exampleId: 'ex-1',
      runId: '32',
      signalName: 'sentiment',
      topicId: '89',
      isOutlier: false,
      signalId: 'sig-1',
      traceId: 'trace-1',
      extractedTraceId: 'extracted-1',
      signalText: 'This is taking forever.',
      x: 0.1,
      y: 0.2,
    },
  ],
  nextOffset: null,
};

const pointsResponse = {
  runId: '32',
  points: [
    { exampleId: 'ex-1', runId: '32', signalName: 'sentiment', topicId: '89', isOutlier: false, x: 0.1, y: 0.2 },
  ],
};

function useEntityLearningHandlers() {
  server.use(
    http.get(`${ENTITY_LEARNING_ROOT}/entities`, () => HttpResponse.json(entitiesResponse)),
    http.get(`${ENTITY_LEARNING_ROOT}/entities/:entityId/topics`, () => HttpResponse.json(topicsResponse)),
    http.get(`${ENTITY_LEARNING_ROOT}/entities/:entityId/topics/:topicId/examples`, () =>
      HttpResponse.json(topicExamplesResponse),
    ),
    http.get(`${ENTITY_LEARNING_ROOT}/entities/:entityId/points`, () => HttpResponse.json(pointsResponse)),
  );
}

// The details/trace route renders the real trace panel, which lazily fetches a
// trace's spans through the Mastra client. The route adapter only owns the
// signal/trace param wiring and close navigation, not the panel internals
// (covered in playground-ui), so an empty observability response is enough to
// mount it without coupling this test to internal trace-detail route shapes.
function useTraceDetailHandlers() {
  server.use(
    http.get(`${BASE_URL}/api/observability/*`, () =>
      HttpResponse.json({ spans: [], pagination: { total: 0, page: 0, perPage: 25, hasMore: false } }),
    ),
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function SignalsTestShell() {
  return (
    <>
      <Outlet />
      <LocationProbe />
    </>
  );
}

function renderSignalsPage(initialEntry = '/signals') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/signals" element={<SignalsTestShell />}>
              <Route index element={<SignalsOverviewPage />} />
              <Route path=":signalId" element={<SignalDetailsPage />} />
              <Route path=":signalId/traces/:traceId" element={<SignalTraceIdPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

beforeEach(() => {
  w.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = OBSERVABILITY_ENDPOINT;
});

afterEach(() => {
  cleanup();
  delete w.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT;
});

describe('Signals page wrappers', () => {
  describe('when an entity is selected on the overview', () => {
    it('navigates to the signal route preserving the entity query params', async () => {
      useEntityLearningHandlers();

      renderSignalsPage('/signals?entityId=entity_support');

      const seeDetails = await screen.findByRole('button', { name: /See details/ });
      fireEvent.click(seeDetails);

      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe('/signals/sentiment?entityId=entity_support'),
      );
    }, 15000);

    it('navigates to the signal route with the clicked cluster topic id', async () => {
      useEntityLearningHandlers();

      renderSignalsPage('/signals?entityId=entity_support');

      const card = (await screen.findAllByRole('button', { name: /Frustrated escalations/ }))[0];
      fireEvent.click(card);

      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe(
          '/signals/sentiment?entityId=entity_support&topicId=89',
        ),
      );
    }, 15000);
  });

  describe('when the details route renders for the selected entity', () => {
    it('passes the route signal param to the reusable details page', async () => {
      useEntityLearningHandlers();

      renderSignalsPage('/signals/sentiment?entityId=entity_support');

      expect(await screen.findByRole('heading', { name: 'Sentiment' })).not.toBeNull();
    });
  });

  describe('when a trace route is active', () => {
    it('renders the details with the trace panel and closes back to the signal route preserving the entity', async () => {
      useEntityLearningHandlers();
      useTraceDetailHandlers();

      renderSignalsPage('/signals/sentiment/traces/trace-1?entityId=entity_support');

      expect(await screen.findByRole('heading', { name: 'Sentiment' })).not.toBeNull();

      const closeButton = await screen.findByRole('button', { name: 'Close Panel' });
      fireEvent.click(closeButton);

      await waitFor(() =>
        expect(screen.getByTestId('location').textContent).toBe('/signals/sentiment?entityId=entity_support'),
      );
    }, 15000);
  });

  describe('when rendering a signal breadcrumb', () => {
    it('resolves the signal name from the playground-ui EE boundary', () => {
      render(
        <MemoryRouter initialEntries={['/signals/tasks']}>
          <Routes>
            <Route path="/signals/:signalId" element={<SignalCrumb />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByText('Tasks')).not.toBeNull();
    });
  });

  describe('when rendering the Signals root breadcrumb', () => {
    it('links back to /signals preserving the current entity query params', () => {
      render(
        <MemoryRouter initialEntries={['/signals/sentiment?entityId=entity_support']}>
          <Routes>
            <Route path="/signals/:signalId" element={<SignalsRootCrumb />} />
          </Routes>
        </MemoryRouter>,
      );

      const link = screen.getByRole('link', { name: 'Signals' });
      expect(link.getAttribute('href')).toBe('/signals?entityId=entity_support');
    });

    it('links to /signals without a query string when no entity params are present', () => {
      render(
        <MemoryRouter initialEntries={['/signals/sentiment']}>
          <Routes>
            <Route path="/signals/:signalId" element={<SignalsRootCrumb />} />
          </Routes>
        </MemoryRouter>,
      );

      const link = screen.getByRole('link', { name: 'Signals' });
      expect(link.getAttribute('href')).toBe('/signals');
    });
  });
});
