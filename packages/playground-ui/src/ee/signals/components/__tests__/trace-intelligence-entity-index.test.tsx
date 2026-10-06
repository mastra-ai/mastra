// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../test/msw-server';
import type { TraceSignalManagement } from '../../trace-intelligence-context';
import { TraceIntelligenceProvider } from '../../trace-intelligence-provider';
import { TraceIntelligenceEntityIndex } from '../trace-intelligence-entity-index';
import type { TraceIntelligenceEntitySort, TraceIntelligenceEntityView } from '../trace-intelligence-entity-index';
import {
  collectingEntityResponse,
  customSignalEntityResponse,
  entityIndexResponse,
  processingEntityResponse,
} from './fixtures/entity-index';

afterEach(() => cleanup());

function IndexHarness({
  initialSearch = '',
  initialSort = 'default',
  initialView = 'list',
}: {
  initialSearch?: string;
  initialSort?: TraceIntelligenceEntitySort;
  initialView?: TraceIntelligenceEntityView;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState(initialSort);
  const [view, setView] = useState(initialView);
  return (
    <TraceIntelligenceEntityIndex
      entityType="agent"
      search={search}
      sort={sort}
      view={view}
      onSearchChange={setSearch}
      onSortChange={setSort}
      onViewChange={setView}
      getEntityHref={entity => `/intelligence/entities/${entity.entityType}/${entity.entityId}`}
    />
  );
}

function renderIndex(options?: Parameters<typeof IndexHarness>[0], signalManagement?: TraceSignalManagement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TraceIntelligenceProvider cacheScope="entity-index-test" signalManagement={signalManagement}>
        <IndexHarness {...options} />
      </TraceIntelligenceProvider>
    </QueryClientProvider>,
  );
}

function useEntityFixture(data: object = entityIndexResponse, status = 200) {
  server.use(
    http.get('/api/learning/entities', ({ request }) => {
      expect(new URL(request.url).searchParams.get('entityType')).toBe('agent');
      return HttpResponse.json(data, { status });
    }),
  );
}

function closestElement(text: string, selector: string): HTMLElement {
  const element = screen.getByText(text).closest(selector);
  if (!(element instanceof HTMLElement)) throw new Error(`${text} does not have a ${selector} ancestor`);
  return element;
}

function closestEntityRow(text: string): HTMLAnchorElement {
  const element = screen.getByText(text).closest('a');
  if (!(element instanceof HTMLAnchorElement)) throw new Error(`${text} does not have a linked entity row ancestor`);
  return element;
}

describe('TraceIntelligenceEntityIndex', () => {
  describe('when the entity response is loading', () => {
    it('renders a loading state', async () => {
      server.use(
        http.get('/api/learning/entities', async () => {
          await delay('infinite');
          return HttpResponse.json(entityIndexResponse);
        }),
      );

      renderIndex();

      expect(screen.getByRole('status', { name: 'Loading Trace Intelligence agents' })).toBeTruthy();
    });
  });

  describe('when the host supplies signal management', () => {
    it('shows the settings action in the index header', async () => {
      useEntityFixture();
      const unsupported = async () => {
        throw new Error('not used');
      };
      renderIndex(undefined, {
        canManage: true,
        list: async () => ({ definitions: [], limits: { maxDefinitionsPerOrganization: 10 } }),
        create: unsupported,
        update: unsupported,
        archive: unsupported,
        restore: unsupported,
        setProjectEnabled: unsupported,
      });

      expect(await screen.findByRole('button', { name: 'Signal settings' })).toBeTruthy();
    });
  });

  describe('when the host omits signal management', () => {
    it('does not show the settings action', async () => {
      useEntityFixture();
      renderIndex();

      await screen.findByText('support-agent');
      expect(screen.queryByRole('button', { name: 'Signal settings' })).toBeNull();
    });
  });

  describe('when enriched entities are available', () => {
    it('explains the configured signals from the index header', async () => {
      useEntityFixture(customSignalEntityResponse);
      renderIndex();

      await screen.findByText('custom-agent');
      fireEvent.focus(screen.getByRole('button', { name: 'What is trace intelligence?' }));

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.textContent).toContain('Tool usage');
      expect(tooltip.textContent).toContain('How effectively the agent uses tools.');
      expect(tooltip.textContent).toContain('Response quality');
      expect(tooltip.textContent).toContain('How useful the final answer is.');
    });

    it('renders entity metadata and canonical detail links', async () => {
      useEntityFixture();
      renderIndex();

      await screen.findByRole('region', { name: 'Trace Intelligence agents' });
      const row = closestEntityRow('support-agent');
      expect(within(row).getByText('12,480')).toBeTruthy();
      expect(within(row).getByText('5 of 5')).toBeTruthy();
      expect(within(row).getByText('Ready')).toBeTruthy();
      expect(row.getAttribute('href')).toBe('/intelligence/entities/agent/support-agent');
    });

    it('keeps collecting agents visible without a detail link', async () => {
      useEntityFixture();
      renderIndex();

      await screen.findByText('billing-agent');
      const agentName = screen.getByText('billing-agent');
      expect(agentName.closest('a')).toBeNull();
      expect(screen.getByText('Waiting for Traces')).toBeTruthy();
    });

    it('explains collected traces when the waiting status receives focus', async () => {
      useEntityFixture();
      renderIndex();

      await screen.findByText('billing-agent');
      fireEvent.focus(screen.getByRole('note', { name: 'Waiting for traces for billing-agent' }));

      expect((await screen.findByRole('tooltip')).textContent).toContain('42 traces collected');
    });

    it('keeps collecting agents non-clickable in compact view', async () => {
      useEntityFixture();
      renderIndex({ initialView: 'compact' });

      const agentName = await screen.findByText('billing-agent');
      const card = agentName.closest('[data-entity-card]');
      expect(card?.querySelector('a')).toBeNull();
      expect(screen.getByRole('link', { name: 'Open agent support-agent' })).toBeTruthy();
    });

    it('filters entity identifiers', async () => {
      useEntityFixture();
      renderIndex();

      await screen.findByText('support-agent');
      fireEvent.change(screen.getByRole('searchbox', { name: 'Filter agents' }), { target: { value: 'billing' } });

      await waitFor(() => expect(screen.queryByText('support-agent')).not.toBeTruthy());
      expect(screen.getByText('billing-agent')).toBeTruthy();

      fireEvent.change(screen.getByRole('searchbox', { name: 'Filter agents' }), { target: { value: 'missing' } });
      expect(await screen.findByText('No agents match your search')).toBeTruthy();
    });

    it('sorts entities from Z to A', async () => {
      useEntityFixture();
      renderIndex();

      await screen.findByText('support-agent');
      fireEvent.click(screen.getByRole('combobox', { name: 'Sort agents' }));
      const descendingOption = await screen.findByRole('option', { name: 'Agent: Z–A' });
      fireEvent.pointerDown(descendingOption, { pointerType: 'mouse' });
      fireEvent.click(descendingOption, { detail: 1 });

      await waitFor(() => {
        const entityIds = screen.getAllByTitle(/-agent$/).map(name => name.textContent);
        expect(entityIds).toEqual(['support-agent', 'research-agent', 'billing-agent']);
      });
    });

    it('renders equivalent metadata in compact view', async () => {
      useEntityFixture();
      renderIndex();

      await screen.findByText('support-agent');
      fireEvent.click(screen.getByRole('button', { name: 'Compact view' }));

      const card = closestElement('support-agent', '[data-entity-card]');
      expect(within(card).getByText('12,480')).toBeTruthy();
      expect(within(card).getByText('5 of 5')).toBeTruthy();
      expect(within(card).getByText('Ready')).toBeTruthy();
    });
  });

  describe.each(['list', 'compact'] as const)('when an agent is processing in %s view', view => {
    it('keeps the detail link available', async () => {
      useEntityFixture(processingEntityResponse);
      renderIndex({ initialView: view });

      expect((await screen.findByRole('link', { name: 'Open agent processing-agent' })).getAttribute('href')).toBe(
        '/intelligence/entities/agent/processing-agent',
      );
    });
  });

  describe.each([
    [undefined, 'Trace count is unavailable'],
    [0, '0 traces collected'],
    [1, '1 trace collected'],
  ])('when a collecting agent has trace count %s', (traceCount, expectedDescription) => {
    it('explains the reported count without inventing a value', async () => {
      useEntityFixture(collectingEntityResponse(traceCount));
      renderIndex();

      await screen.findByText('new-agent');
      fireEvent.focus(screen.getByRole('note', { name: 'Waiting for traces for new-agent' }));

      expect((await screen.findByRole('tooltip')).textContent).toContain(expectedDescription);
    });
  });

  describe('when an older server omits index metadata', () => {
    it('renders conservative unavailable fallbacks', async () => {
      useEntityFixture({
        entities: [
          {
            entityId: 'legacy-agent',
            entityType: 'agent',
            availableSignals: ['goal'],
            signalCatalog: [
              {
                name: 'goal',
                label: 'Goal',
                description: 'Goal signal',
                order: 0,
                builtIn: true,
                enabled: true,
                status: 'ready',
              },
              {
                name: 'outcome',
                label: 'Outcome',
                description: 'Outcome signal',
                order: 1,
                builtIn: true,
                enabled: true,
                status: 'collecting',
              },
            ],
          },
        ],
      });
      renderIndex();

      await screen.findByText('legacy-agent');
      const row = closestEntityRow('legacy-agent');
      expect(within(row).getAllByText('—')).toHaveLength(2);
      expect(within(row).getByText('1 of 2')).toBeTruthy();
      expect(within(row).getByText('Unavailable')).toBeTruthy();
      expect(within(row).queryByText('Ready')).not.toBeTruthy();
    });
  });

  describe('when no entities are available', () => {
    it('renders the empty state', async () => {
      useEntityFixture({ entities: [] });
      renderIndex();

      expect(await screen.findByText('No Trace Intelligence agents yet')).toBeTruthy();
    });
  });

  describe.each([
    [401, 'Your session has expired'],
    [403, 'Permission denied'],
    [500, 'Failed to load Trace Intelligence'],
  ])('when the entity request returns %i', (status, expectedText) => {
    it('renders the matching error state', async () => {
      useEntityFixture({ message: 'request failed' }, status);
      renderIndex();

      expect(await screen.findByText(new RegExp(expectedText, 'i'))).toBeTruthy();
    });
  });

  describe('when controlled index state changes', () => {
    it('reports search, sort, and view changes to the host', async () => {
      useEntityFixture();
      const onSearchChange = vi.fn();
      const onSortChange = vi.fn();
      const onViewChange = vi.fn();
      const queryClient = new QueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <TraceIntelligenceProvider cacheScope="controlled-state-test">
            <TraceIntelligenceEntityIndex
              entityType="agent"
              search=""
              sort="default"
              view="list"
              onSearchChange={onSearchChange}
              onSortChange={onSortChange}
              onViewChange={onViewChange}
              getEntityHref={() => '/detail'}
            />
          </TraceIntelligenceProvider>
        </QueryClientProvider>,
      );

      await screen.findByText('support-agent');
      fireEvent.change(screen.getByRole('searchbox', { name: 'Filter agents' }), { target: { value: 'support' } });
      await waitFor(() => expect(onSearchChange).toHaveBeenCalledWith('support'));
      fireEvent.click(screen.getByRole('button', { name: 'Compact view' }));
      expect(onViewChange).toHaveBeenCalledWith('compact');
      fireEvent.click(screen.getByRole('combobox', { name: 'Sort agents' }));
      const ascendingOption = await screen.findByRole('option', { name: 'Agent: A–Z' });
      fireEvent.pointerDown(ascendingOption, { pointerType: 'mouse' });
      fireEvent.click(ascendingOption, { detail: 1 });
      expect(onSortChange.mock.calls[0]?.[0]).toBe('entity-asc');
    });
  });
});
