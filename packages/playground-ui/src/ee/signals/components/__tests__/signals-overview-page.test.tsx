// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { entitiesResponse, topicsResponse } from '../../services/__tests__/fixtures/entity-learning';
import type { SelectedEntity } from '../../types';
import { SignalsOverviewPage } from '../signals-overview-page';

const BASE_URL = 'https://observability.test';
const ROOT = `${BASE_URL}/entity-learning`;

const server = setupServer();

type EntityLearningWindow = typeof globalThis & {
  MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT?: string;
};
const w = window as EntityLearningWindow;

// `react-resizable-panels` drives layout through a ResizeObserver-backed group
// controller that throws under jsdom. Stub it to plain elements and keep every
// first-party component (TopicsLayout, the entity filter, sections) real.
vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Panel: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Separator: () => null,
  usePanelRef: () => ({ current: null }),
}));

function renderOverview(
  selectedEntity: SelectedEntity | null,
  onSignalSelect: (signalName: string, topicId?: string) => void = () => {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <SignalsOverviewPage selectedEntity={selectedEntity} onEntityChange={() => {}} onSignalSelect={onSignalSelect} />
    </QueryClientProvider>,
  );
}

beforeAll(() => {
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
  w.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT = BASE_URL;
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  delete w.MASTRA_PLATFORM_OBSERVABILITY_ENDPOINT;
});

afterAll(() => server.close());

describe('SignalsOverviewPage', () => {
  describe('when no entity is selected', () => {
    it('prompts the user to select an entity', async () => {
      server.use(http.get(`${ROOT}/entities`, () => HttpResponse.json(entitiesResponse)));

      renderOverview(null);

      expect(await screen.findByText('Select an entity to inspect its signals and clusters.')).not.toBeNull();
    });

    it('keeps the entity filter pinned at the top regardless of selection', async () => {
      server.use(http.get(`${ROOT}/entities`, () => HttpResponse.json(entitiesResponse)));

      renderOverview(null);

      // The filter bar (both selects) is present even before an entity is picked.
      expect(await screen.findByLabelText('Entity type')).not.toBeNull();
      expect(screen.getByLabelText('Entity')).not.toBeNull();
    });
  });

  describe('when an entity is selected', () => {
    it('renders a section per available signal with clusters from /topics', async () => {
      server.use(
        http.get(`${ROOT}/entities`, () => HttpResponse.json(entitiesResponse)),
        http.get(`${ROOT}/entities/:entityId/topics`, () => HttpResponse.json(topicsResponse)),
      );

      renderOverview({ entityType: 'agent', entityId: 'entity_support' });

      // entity_support exposes the `sentiment` and `behavior` signals.
      expect(await screen.findByRole('heading', { name: 'Sentiment' })).not.toBeNull();
      expect(screen.getByRole('heading', { name: 'Behavior' })).not.toBeNull();

      // Clusters (topics) are rendered as cards.
      expect(await screen.findAllByRole('heading', { name: 'Frustrated escalations' })).not.toHaveLength(0);
      expect(screen.getAllByRole('heading', { name: 'Satisfied resolutions' }).length).toBeGreaterThan(0);
    });

    it('calls onSignalSelect with the signal name and topic id when a cluster card is clicked', async () => {
      server.use(
        http.get(`${ROOT}/entities`, () => HttpResponse.json(entitiesResponse)),
        http.get(`${ROOT}/entities/:entityId/topics`, () => HttpResponse.json(topicsResponse)),
      );

      const onSignalSelect = vi.fn();
      renderOverview({ entityType: 'agent', entityId: 'entity_support' }, onSignalSelect);

      const card = (await screen.findAllByRole('button', { name: /Frustrated escalations/ }))[0];
      fireEvent.click(card);

      expect(onSignalSelect).toHaveBeenCalledWith('sentiment', '89');
    });
  });

  describe('when the entities request fails', () => {
    it('shows the failure state', async () => {
      server.use(http.get(`${ROOT}/entities`, () => new HttpResponse(null, { status: 500 })));

      renderOverview(null);

      expect(await screen.findByText('Failed to load entities from the observability endpoint.')).not.toBeNull();
    });
  });
});
