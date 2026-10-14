import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import DatasetsPage from '..';
import { buildDataset, buildListDatasetsResponse } from '@/domains/datasets/components/__tests__/fixtures/datasets';
import {
  buildListExperimentsResponse,
  experiments,
} from '@/domains/experiments/components/__tests__/fixtures/experiments';
import { agents } from '@/domains/experiments/components/__tests__/fixtures/target-registries';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// `experiments[0]` belongs to dataset-1, so only Alpha has experiments.
const alpha = buildDataset({
  id: 'dataset-1',
  name: 'Alpha',
  tags: ['support'],
  targetType: 'agent',
  targetIds: ['agent-1'],
});
const beta = buildDataset({
  id: 'dataset-2',
  name: 'Beta',
  tags: ['billing'],
  targetType: 'agent',
  targetIds: ['agent-2'],
});

function setupHandlers() {
  const calls = { datasetQueries: [] as URLSearchParams[] };

  server.use(
    http.get(`${TEST_BASE_URL}/api/agents`, () => HttpResponse.json(agents)),
    http.get(`${TEST_BASE_URL}/api/datasets`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      calls.datasetQueries.push(query);
      const targetType = query.get('targetType');
      const targetIds = query.getAll('targetIds');
      const list = [alpha, beta].filter(
        ds =>
          (!targetType || ds.targetType === targetType) &&
          (targetIds.length === 0 || targetIds.some(id => ds.targetIds?.includes(id))),
      );
      return HttpResponse.json(buildListDatasetsResponse(list));
    }),
    http.get(`${TEST_BASE_URL}/api/experiments`, () =>
      HttpResponse.json(buildListExperimentsResponse([experiments[0]])),
    ),
  );

  return calls;
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

const renderPage = (initialEntry = '/datasets') =>
  renderWithProviders(
    <TooltipProvider>
      <TestLinkProvider>
        <Routes>
          <Route path="/datasets" element={<DatasetsPage />} />
        </Routes>
        <LocationProbe />
      </TestLinkProvider>
    </TooltipProvider>,
    { router: { initialEntries: [initialEntry] } },
  );

const getFilterInput = () => screen.getByRole('combobox', { name: 'Add filter' }) as HTMLInputElement;
const getChips = () => document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]');
const typeFilter = (text: string) => fireEvent.change(getFilterInput(), { target: { value: text } });
const pressFilterKey = (key: string) => fireEvent.keyDown(getFilterInput(), { key });
const getLocation = () => screen.getByTestId('location').textContent;

/**
 * Builds a `<field> is <value>` filter through the typeahead input. Typed text lands on the
 * search field first, so the named field is one ArrowDown away.
 */
const pickFilter = async (field: string, value: string) => {
  getFilterInput().focus();
  typeFilter(field);
  await screen.findByRole('option', { name: field });
  pressFilterKey('ArrowDown');
  pressFilterKey('Enter');
  typeFilter(value);
  await screen.findByRole('option', { name: value });
  pressFilterKey('Enter');
};

describe('Datasets page filter bar', () => {
  describe('when no filter is set', () => {
    it('renders an empty filter bar in the action row', async () => {
      setupHandlers();
      renderPage();

      await screen.findByRole('group', { name: 'Datasets filters' });
      await screen.findByText('Alpha');
      expect(getChips()).toHaveLength(0);
    });
  });

  describe('when an Experiments chip is added', () => {
    it('only lists datasets without experiments when asked', async () => {
      setupHandlers();
      renderPage();
      await screen.findByText('Beta');

      await pickFilter('Experiments', 'Without experiments');

      await screen.findByRole('group', { name: 'Experiments Without experiments' });
      await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull());
      expect(screen.getByText('Beta')).toBeDefined();
    });
  });

  describe('when a Tag chip is added', () => {
    it('only lists datasets carrying that tag', async () => {
      setupHandlers();
      renderPage();
      await screen.findByText('Beta');

      await pickFilter('Tag', 'billing');

      await screen.findByRole('group', { name: 'Tag billing' });
      await waitFor(() => expect(screen.queryByText('Alpha')).toBeNull());
      expect(screen.getByText('Beta')).toBeDefined();
    });
  });

  describe('when free text is committed', () => {
    it('adds a search chip that narrows the list', async () => {
      setupHandlers();
      renderPage();
      await screen.findByText('Beta');

      getFilterInput().focus();
      typeFilter('alp');
      await screen.findByRole('option', { name: /contains "alp"/ });
      pressFilterKey('Enter');

      await screen.findByRole('group', { name: 'Search alp' });
      await waitFor(() => expect(screen.queryByText('Beta')).toBeNull());
      expect(screen.getByText('Alpha')).toBeDefined();
    });
  });

  describe('when no dataset matches the filters', () => {
    it('says so instead of showing an empty table', async () => {
      setupHandlers();
      renderPage();
      await screen.findByText('Beta');

      getFilterInput().focus();
      typeFilter('zzz-nomatch');
      await screen.findByRole('option', { name: /contains "zzz-nomatch"/ });
      pressFilterKey('Enter');

      expect(await screen.findByText('No datasets match your filters')).toBeDefined();
    });
  });

  describe('when Target type and target chips are added', () => {
    it('forwards targetType and targetIds to the server', async () => {
      const calls = setupHandlers();
      renderPage();
      await screen.findByText('Beta');

      await pickFilter('Target type', 'Agent');
      await waitFor(() => expect(getLocation()).toBe('/datasets?targetType=agent'));

      await pickFilter('Agent', 'Support Agent');
      await waitFor(() => expect(getLocation()).toBe('/datasets?targetType=agent&targetId=agent-1'));

      await waitFor(() => expect(screen.queryByText('Beta')).toBeNull());
      const lastQuery = calls.datasetQueries.at(-1)!;
      expect(lastQuery.get('targetType')).toBe('agent');
      expect(lastQuery.getAll('targetIds')).toEqual(['agent-1']);
    });
  });

  describe('when ?targetType= and ?targetId= are in the URL', () => {
    it('drops the target id when the target type chip is removed', async () => {
      setupHandlers();
      renderPage('/datasets?targetType=agent&targetId=agent-1');

      const chip = await screen.findByRole('group', { name: 'Target type Agent' });
      fireEvent.click(within(chip).getByRole('button', { name: 'Remove Target type filter' }));

      await waitFor(() => expect(getLocation()).toBe('/datasets'));
    });
  });
});
