// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ENTITY_ID,
  entitiesResponse,
  pointsResponse,
  topicExamplesResponse,
  topicsResponse,
} from '../hooks/__tests__/fixtures/entity-learning';
import { singleTraceResponse } from './__tests__/fixtures/signal-traces';
import { SignalDetailsPage } from './signal-details-page';

const BASE_URL = 'http://localhost:4111';
const PLATFORM_URL = 'https://platform.test';
const server = setupServer();

// `react-resizable-panels` drives its layout through a ResizeObserver-backed
// group controller whose `mountGroup` throws (`n is not a constructor`) under
// jsdom. It is a third-party DOM boundary, so we stub it to plain elements and
// keep every first-party component (TopicsLayout, the trace panel, the chart)
// real per the package testing rules.
vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Separator: () => null,
  usePanelRef: () => ({ current: null }),
}));

function useEntityLearningHandlers() {
  server.use(
    http.get(`${PLATFORM_URL}/entity-learning/entities`, () => HttpResponse.json(entitiesResponse)),
    http.get(`${PLATFORM_URL}/entity-learning/entities/${ENTITY_ID}/topics`, () => HttpResponse.json(topicsResponse)),
    http.get(`${PLATFORM_URL}/entity-learning/entities/${ENTITY_ID}/topics/:topicId/examples`, () =>
      HttpResponse.json(topicExamplesResponse),
    ),
    http.get(`${PLATFORM_URL}/entity-learning/entities/${ENTITY_ID}/points`, () => HttpResponse.json(pointsResponse)),
    http.get(`${BASE_URL}/api/observability/traces`, () => HttpResponse.json(singleTraceResponse)),
  );
}

function renderSignalDetailsPage(tracePanel: ReactNode = <aside aria-label="Trace details">Trace panel</aside>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <SignalDetailsPage
          signalId="sentiment"
          selectedTraceId="trace-1"
          tracePanel={tracePanel}
          onTraceSelect={() => {}}
        />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

beforeAll(() => {
  // jsdom does not implement matchMedia; CollapsiblePanel reads it to detect the
  // reduced-motion preference. Provide a minimal stub so the real first-party
  // layout components render without a third-party DOM API gap.
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;

  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  delete (window as { MASTRA_CLOUD_API_ENDPOINT?: string }).MASTRA_CLOUD_API_ENDPOINT;
  delete (window as { MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT?: string }).MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT;
});

afterAll(() => server.close());

describe('SignalDetailsPage', () => {
  it('shows the trace panel only while the trace list tab is active', async () => {
    window.MASTRA_CLOUD_API_ENDPOINT = PLATFORM_URL;
    useEntityLearningHandlers();

    renderSignalDetailsPage();

    // Wait for the entity/topics to resolve and the sidebar to render.
    await screen.findByText('Neutral Curiosity');

    expect(screen.getByRole('complementary', { name: 'Trace details' })).not.toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Chart' }));

    expect(screen.queryByRole('complementary', { name: 'Trace details' })).toBeNull();
    expect(screen.getByLabelText('Chart cluster filters')).not.toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Trace list' }));

    expect(screen.getByRole('complementary', { name: 'Trace details' })).not.toBeNull();
  });

  it('renders the topic sidebar and example traces from the API', async () => {
    window.MASTRA_CLOUD_API_ENDPOINT = PLATFORM_URL;
    useEntityLearningHandlers();

    renderSignalDetailsPage();

    expect(await screen.findByText('Neutral Curiosity')).not.toBeNull();
    expect(screen.getByText('Low-Emotion Curiosity')).not.toBeNull();
    // Example signalText surfaces as a trace row name.
    await waitFor(() =>
      expect(
        screen.getByText(
          'The user shows low emotional escalation, primarily curiosity, indicating a straightforward informational request.',
        ),
      ).not.toBeNull(),
    );
  });

  it('shows a loading skeleton while the entity is pending', () => {
    window.MASTRA_CLOUD_API_ENDPOINT = PLATFORM_URL;
    useEntityLearningHandlers();

    renderSignalDetailsPage();

    expect(screen.getByLabelText('Loading signal')).not.toBeNull();
  });

  it('shows an error state when the entities request fails', async () => {
    window.MASTRA_CLOUD_API_ENDPOINT = PLATFORM_URL;
    server.use(
      http.get(`${PLATFORM_URL}/entity-learning/entities`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${BASE_URL}/api/observability/traces`, () => HttpResponse.json(singleTraceResponse)),
    );

    renderSignalDetailsPage();

    expect(await screen.findByText("Couldn't load signal")).not.toBeNull();
  });
});
