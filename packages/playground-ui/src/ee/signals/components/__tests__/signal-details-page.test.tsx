// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
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

function renderSignalDetailsPage({
  entity = SUPPORT_ENTITY as SelectedEntity | null,
  selectedTraceId = 'trace-1' as string | null,
  initialTopicId = null as string | null,
  tracePanel = (<aside aria-label="Trace details">Trace panel</aside>) as ReactNode,
  onTraceSelect = () => {},
}: {
  entity?: SelectedEntity | null;
  selectedTraceId?: string | null;
  initialTopicId?: string | null;
  tracePanel?: ReactNode;
  onTraceSelect?: (signalId: string, traceId: string) => void;
} = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <SignalDetailsPage
          signalId="sentiment"
          entity={entity}
          selectedTraceId={selectedTraceId}
          initialTopicId={initialTopicId}
          tracePanel={tracePanel}
          onTraceSelect={onTraceSelect}
        />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
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

  describe('when the entity request fails', () => {
    it('shows the error layout instead of the cluster UI', async () => {
      server.use(http.get(`${ROOT}/entities`, () => new HttpResponse(null, { status: 500 })));

      renderSignalDetailsPage();

      expect(await screen.findByText('Failed to load this signal from the observability endpoint.')).not.toBeNull();
      expect(screen.queryByRole('tab', { name: 'Chart' })).toBeNull();
    });
  });

  describe('when entities are still loading', () => {
    it('shows the loading copy', () => {
      server.use(http.get(`${ROOT}/entities`, () => new Promise(() => {})));

      renderSignalDetailsPage();

      expect(screen.getByText('Loading signal…')).not.toBeNull();
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
