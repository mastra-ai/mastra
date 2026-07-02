// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  behaviorTopicsResponse,
  entitiesResponse,
  topicExamplesResponse,
  topicsResponse,
  pointsResponse,
} from '../../services/__tests__/fixtures/entity-learning';
import type { SelectedEntity } from '../../types';
import { SignalDetailsPage } from '../signal-details-page';

const BASE_URL = 'http://localhost:4111';
const OBSERVABILITY_ENDPOINT = 'https://observability.test';
const ROOT = `${OBSERVABILITY_ENDPOINT}/entity-learning`;

const server = setupServer();

type EntityLearningWindow = typeof globalThis & {
  MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT?: string;
};
const w = window as EntityLearningWindow;

// `react-resizable-panels` drives its layout through a ResizeObserver-backed
// group controller whose `mountGroup` throws (`n is not a constructor`) under
// jsdom. It is a third-party DOM boundary, so we stub it to plain elements and
// keep every first-party component (TopicsLayout, the trace panel, the chart)
// real per the package testing rules — our own hooks/services are never mocked.
vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Separator: () => null,
  usePanelRef: () => ({ current: null }),
}));

const SUPPORT_ENTITY: SelectedEntity = { entityType: 'agent', entityId: 'entity_support' };

type RenderSignalDetailsPageOptions = {
  entity?: SelectedEntity | null;
  signalId?: string;
  selectedTraceId?: string | null;
  initialTopicId?: string | null;
  tracePanel?: ReactNode;
  onTraceSelect?: (signalId: string, traceId: string) => void;
};

function renderSignalDetailsPage(options: RenderSignalDetailsPageOptions = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const defaultOptions = {
    entity: SUPPORT_ENTITY as SelectedEntity | null,
    signalId: 'sentiment',
    selectedTraceId: 'trace-1' as string | null,
    initialTopicId: null as string | null,
    tracePanel: <aside aria-label="Trace details">Trace panel</aside>,
    onTraceSelect: () => {},
  } satisfies Required<RenderSignalDetailsPageOptions>;

  const renderPage = (nextOptions: RenderSignalDetailsPageOptions = {}) => {
    const props = { ...defaultOptions, ...options, ...nextOptions };
    return (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <SignalDetailsPage
            signalId={props.signalId}
            entity={props.entity}
            selectedTraceId={props.selectedTraceId}
            initialTopicId={props.initialTopicId}
            tracePanel={props.tracePanel}
            onTraceSelect={props.onTraceSelect}
          />
        </QueryClientProvider>
      </MastraReactProvider>
    );
  };

  const result = render(renderPage());

  return {
    ...result,
    rerenderSignalDetailsPage: (nextOptions: RenderSignalDetailsPageOptions = {}) =>
      result.rerender(renderPage(nextOptions)),
  };
}

/** Entity-learning happy path: entities, topics, the selected topic's examples, points. */
function useLiveDataHandlers() {
  server.use(
    http.get(`${ROOT}/entities`, () => HttpResponse.json(entitiesResponse)),
    http.get(`${ROOT}/entities/:entityId/topics`, () => HttpResponse.json(topicsResponse)),
    http.get(`${ROOT}/entities/:entityId/topics/:topicId/examples`, () => HttpResponse.json(topicExamplesResponse)),
    http.get(`${ROOT}/entities/:entityId/points`, () => HttpResponse.json(pointsResponse)),
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

beforeEach(() => {
  w.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = OBSERVABILITY_ENDPOINT;
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  delete w.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT;
});

afterAll(() => server.close());

describe('SignalDetailsPage', () => {
  describe('when entities and topics load', () => {
    it('renders live topics in the sidebar and the selected topic examples in the trace list', async () => {
      useLiveDataHandlers();

      renderSignalDetailsPage();

      // Topics (clusters) from /topics render in the sidebar.
      expect(await screen.findByText('Frustrated escalations')).not.toBeNull();
      expect(screen.getByText('Satisfied resolutions')).not.toBeNull();

      // The first topic's examples (signalText) drive the trace list.
      expect(await screen.findByText('This is taking forever.')).not.toBeNull();
    });

    it('keeps the Chart tab cluster filters', async () => {
      useLiveDataHandlers();

      renderSignalDetailsPage();

      await screen.findByText('Frustrated escalations');

      fireEvent.click(screen.getByRole('tab', { name: 'Chart' }));

      expect(screen.getByLabelText('Chart cluster filters')).not.toBeNull();
    });
  });

  describe('when an initial topic id is provided', () => {
    it('selects that topic by default in the trace list sidebar', async () => {
      useLiveDataHandlers();

      renderSignalDetailsPage({ initialTopicId: '90' });

      // The non-default topic ("Satisfied resolutions" = topic 90) is selected.
      const selected = await screen.findByRole('button', { name: /Satisfied resolutions/, pressed: true });
      expect(selected).not.toBeNull();

      // The default first topic ("Frustrated escalations" = topic 89) is not selected.
      expect(screen.getByRole('button', { name: /Frustrated escalations/, pressed: false })).not.toBeNull();
    });

    it('updates the selected topic when initialTopicId changes after navigation', async () => {
      useLiveDataHandlers();
      const requestedTopicIds: string[] = [];
      server.use(
        http.get(`${ROOT}/entities/:entityId/topics/:topicId/examples`, ({ params }) => {
          const topicId = String(params.topicId);
          requestedTopicIds.push(topicId);
          return HttpResponse.json({
            ...topicExamplesResponse,
            examples: [
              {
                ...topicExamplesResponse.examples[0],
                exampleId: `ex-${topicId}`,
                topicId,
                traceId: `trace-${topicId}`,
                signalText: `Example for topic ${topicId}`,
              },
            ],
          });
        }),
      );

      const { rerenderSignalDetailsPage } = renderSignalDetailsPage({ initialTopicId: '89' });

      expect(await screen.findByRole('button', { name: /Frustrated escalations/, pressed: true })).not.toBeNull();
      expect(await screen.findByText('Example for topic 89')).not.toBeNull();

      rerenderSignalDetailsPage({ initialTopicId: '90' });

      expect(await screen.findByRole('button', { name: /Satisfied resolutions/, pressed: true })).not.toBeNull();
      expect(await screen.findByText('Example for topic 90')).not.toBeNull();
      expect(requestedTopicIds).toContain('89');
      expect(requestedTopicIds).toContain('90');
    });
  });

  describe('when navigating between signal topic sets', () => {
    it('does not keep stale sidebar or chart selections', async () => {
      server.use(
        http.get(`${ROOT}/entities`, () => HttpResponse.json(entitiesResponse)),
        http.get(`${ROOT}/entities/:entityId/topics`, ({ params }) => {
          if (params.entityId === 'entity_search') {
            return HttpResponse.json({
              ...topicsResponse,
              run: { ...topicsResponse.run, runId: '7', signalName: 'outcome', topicCount: 1 },
              topics: [
                {
                  ...topicsResponse.topics[0],
                  topicId: 'search-1',
                  runId: '7',
                  signalName: 'outcome',
                  name: 'Search successes',
                  description: 'Searches that returned useful results.',
                },
              ],
            });
          }

          return HttpResponse.json(topicsResponse);
        }),
        http.get(`${ROOT}/entities/:entityId/topics/:topicId/examples`, ({ params }) => {
          const topicId = String(params.topicId);
          return HttpResponse.json({
            ...topicExamplesResponse,
            runId: params.entityId === 'entity_search' ? '7' : '32',
            examples: [
              {
                ...topicExamplesResponse.examples[0],
                exampleId: `ex-${topicId}`,
                runId: params.entityId === 'entity_search' ? '7' : '32',
                signalName: params.entityId === 'entity_search' ? 'outcome' : 'sentiment',
                topicId,
                traceId: `trace-${topicId}`,
                signalText: `Example for ${topicId}`,
              },
            ],
          });
        }),
        http.get(`${ROOT}/entities/:entityId/points`, ({ params }) =>
          HttpResponse.json({
            ...pointsResponse,
            runId: params.entityId === 'entity_search' ? '7' : '32',
            points: [
              {
                ...pointsResponse.points[0],
                exampleId: params.entityId === 'entity_search' ? 'ex-search-1' : 'ex-89',
                runId: params.entityId === 'entity_search' ? '7' : '32',
                signalName: params.entityId === 'entity_search' ? 'outcome' : 'sentiment',
                topicId: params.entityId === 'entity_search' ? 'search-1' : '89',
              },
            ],
          }),
        ),
      );

      const { rerenderSignalDetailsPage } = renderSignalDetailsPage({ initialTopicId: '90' });

      expect(await screen.findByRole('button', { name: /Satisfied resolutions/, pressed: true })).not.toBeNull();
      fireEvent.click(screen.getByRole('tab', { name: 'Chart' }));
      fireEvent.click(screen.getByRole('checkbox', { name: /Satisfied resolutions/, checked: true }));
      expect(screen.getByRole('checkbox', { name: /Satisfied resolutions/, checked: false })).not.toBeNull();

      rerenderSignalDetailsPage({
        entity: { entityType: 'tool', entityId: 'entity_search' },
        signalId: 'outcome',
        initialTopicId: null,
      });

      expect(await screen.findByText('Search successes')).not.toBeNull();
      expect(screen.queryByText('Satisfied resolutions')).toBeNull();
      expect(screen.getByRole('checkbox', { name: /Search successes/, checked: true })).not.toBeNull();

      fireEvent.click(screen.getByRole('tab', { name: 'Trace list' }));
      expect(await screen.findByRole('button', { name: /Search successes/, pressed: true })).not.toBeNull();
      expect(await screen.findByText('Example for search-1')).not.toBeNull();
    });
  });

  describe('when the signal latest run differs from the entity-wide latestRunId', () => {
    it('queries examples and points with the run resolved by /topics', async () => {
      const capturedRunIds: { examples?: string | null; points?: string | null } = {};
      server.use(
        http.get(`${ROOT}/entities`, () => HttpResponse.json(entitiesResponse)),
        // `behavior`'s latest run is '31'; entity_support.latestRunId is '32'.
        http.get(`${ROOT}/entities/:entityId/topics`, () => HttpResponse.json(behaviorTopicsResponse)),
        http.get(`${ROOT}/entities/:entityId/topics/:topicId/examples`, ({ request }) => {
          capturedRunIds.examples = new URL(request.url).searchParams.get('runId');
          return HttpResponse.json({ ...topicExamplesResponse, runId: '31' });
        }),
        http.get(`${ROOT}/entities/:entityId/points`, ({ request }) => {
          capturedRunIds.points = new URL(request.url).searchParams.get('runId');
          return HttpResponse.json({ ...pointsResponse, runId: '31' });
        }),
      );

      renderSignalDetailsPage({ signalId: 'behavior' });

      expect(await screen.findByText('Repeated retries')).not.toBeNull();
      await waitFor(() => expect(capturedRunIds.examples).toBe('31'));
      await waitFor(() => expect(capturedRunIds.points).toBe('31'));
    });
  });

  describe('when a trace row is clicked', () => {
    it('calls onTraceSelect with the signal id and the example trace id', async () => {
      useLiveDataHandlers();
      const onTraceSelect = vi.fn();

      renderSignalDetailsPage({ onTraceSelect });

      const row = await screen.findByText('This is taking forever.');
      fireEvent.click(row);

      expect(onTraceSelect).toHaveBeenCalledWith('sentiment', 'trace-1');
    });
  });

  describe('when the trace list tab is active', () => {
    it('shows the trace panel only on the trace list tab', async () => {
      useLiveDataHandlers();

      renderSignalDetailsPage();

      await screen.findByText('Frustrated escalations');

      expect(screen.getByRole('complementary', { name: 'Trace details' })).not.toBeNull();

      fireEvent.click(screen.getByRole('tab', { name: 'Chart' }));

      expect(screen.queryByRole('complementary', { name: 'Trace details' })).toBeNull();

      fireEvent.click(screen.getByRole('tab', { name: 'Trace list' }));

      expect(screen.getByRole('complementary', { name: 'Trace details' })).not.toBeNull();
    });
  });

  describe('when the topic examples are still loading', () => {
    it('shows a skeleton trace list instead of the empty-state copy', async () => {
      server.use(
        http.get(`${ROOT}/entities`, () => HttpResponse.json(entitiesResponse)),
        http.get(`${ROOT}/entities/:entityId/topics`, () => HttpResponse.json(topicsResponse)),
        http.get(`${ROOT}/entities/:entityId/points`, () => HttpResponse.json(pointsResponse)),
        // Topics resolve but the selected topic's examples never settle.
        http.get(`${ROOT}/entities/:entityId/topics/:topicId/examples`, () => new Promise(() => {})),
      );

      renderSignalDetailsPage();

      // Topics rendered, so we are past the page-level loading gate.
      await screen.findByText('Frustrated escalations');

      // Skeleton placeholder is shown for the in-flight trace list.
      expect(screen.getByLabelText('Loading traces')).not.toBeNull();
      // The empty-state copy must not flash while examples are loading.
      expect(screen.queryByText('No traces match this subtopic.')).toBeNull();
    });
  });

  describe('when the entity request fails', () => {
    it('shows the error layout instead of the cluster UI', async () => {
      server.use(http.get(`${ROOT}/entities`, () => new HttpResponse(null, { status: 500 })));

      renderSignalDetailsPage();

      expect(await screen.findByText('Failed to load this signal from the observability endpoint.')).not.toBeNull();
      expect(screen.queryByRole('tab', { name: 'Chart' })).toBeNull();
    });
  });

  describe('when entities are still loading', () => {
    it('shows the details skeleton', () => {
      server.use(http.get(`${ROOT}/entities`, () => new Promise(() => {})));

      renderSignalDetailsPage();

      expect(screen.getByLabelText('Loading signal')).not.toBeNull();
    });
  });

  describe('when no entity is selected', () => {
    it('shows the signal not found fallback', async () => {
      server.use(http.get(`${ROOT}/entities`, () => HttpResponse.json(entitiesResponse)));

      renderSignalDetailsPage({ entity: null });

      expect(await screen.findByText('Signal not found')).not.toBeNull();
    });
  });
});
