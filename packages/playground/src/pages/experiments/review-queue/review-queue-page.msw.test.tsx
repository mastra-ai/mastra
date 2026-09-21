import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import ReviewQueuePage from '.';
import {
  DATASET_ID,
  EXPERIMENT_ID,
  experiment,
  results,
} from '@/domains/experiments/__tests__/fixtures/experiment-item-route';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

const OTHER_EXPERIMENT_ID = 'exp-2';
const otherExperiment = { ...experiment, id: OTHER_EXPERIMENT_ID, name: 'entity-extraction / model-b' };
const otherResults = [
  {
    ...results[2],
    id: 'res-other',
    itemId: 'item-other',
    experimentId: OTHER_EXPERIMENT_ID,
    input: { q: 'other question' },
  },
];
const experimentsResponse = {
  experiments: [experiment, otherExperiment],
  pagination: { total: 2, page: 0, perPage: 100, hasMore: false },
};

const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!;
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  // jsdom ships no PointerEvent, and Base UI constructs one on press.
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEventStub extends MouseEvent {}
    window.PointerEvent = PointerEventStub as unknown as typeof PointerEvent;
  }
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 800 });
});

afterAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
});

const resultRequests: string[] = [];
// The review and completed queues each fetch results, so dedupe before asserting scope.
const requestedExperiments = () => [...new Set(resultRequests)].sort();

beforeEach(() => {
  resultRequests.length = 0;
  server.use(
    http.get(`${TEST_BASE_URL}/api/experiments`, () => HttpResponse.json(experimentsResponse)),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}`, () =>
      HttpResponse.json({ error: 'not found' }, { status: 404 }),
    ),
    http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/:experimentId/results`, ({ params }) => {
      resultRequests.push(String(params.experimentId));
      const list = params.experimentId === EXPERIMENT_ID ? results : otherResults;
      return HttpResponse.json({
        results: list,
        pagination: { total: list.length, page: 0, perPage: 100, hasMore: false },
      });
    }),
  );
});

const getFilterInput = () => screen.getByRole('combobox', { name: 'Add filter' }) as HTMLInputElement;
const getChips = () => document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]');
const typeFilter = (text: string) => fireEvent.change(getFilterInput(), { target: { value: text } });
const pressFilterKey = (key: string) => fireEvent.keyDown(getFilterInput(), { key });

/** Builds a `<field> is <value>` filter through the typeahead input. */
const pickFilter = async (field: string, value: string) => {
  getFilterInput().focus();
  typeFilter(field);
  await screen.findByRole('option', { name: field });
  pressFilterKey('Enter');
  typeFilter(value);
  await screen.findByRole('option', { name: value });
  pressFilterKey('Enter');
};
const pickExperiment = (name: string) => pickFilter('Experiment', name);

const renderPage = (search = '') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '/experiments/review-queue',
        element: (
          <TestLinkProvider>
            <ReviewQueuePage />
          </TestLinkProvider>
        ),
      },
    ],
    {
      initialEntries: [`/experiments/review-queue${search}`],
    },
  );

  render(
    <MastraReactProvider baseUrl={TEST_BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );

  return { router };
};

describe('Review Queue page', () => {
  describe('when no experiment is selected', () => {
    it('lists items awaiting review across every experiment', async () => {
      renderPage();

      await screen.findByRole('group', { name: 'Review queue filters' });
      expect(getChips()).toHaveLength(0);

      await screen.findByText(/third question/);
      await screen.findByText(/other question/);
      expect(requestedExperiments()).toEqual([EXPERIMENT_ID, OTHER_EXPERIMENT_ID]);
    });
  });

  describe('when ?experiment points at a loaded experiment', () => {
    it('shows it as a filter chip and shows only its review queue', async () => {
      renderPage(`?experiment=${EXPERIMENT_ID}`);

      await screen.findByRole('group', { name: `Experiment ${experiment.name}` });

      await screen.findByText(/third question/);
      expect(screen.queryByText(/other question/)).toBeNull();
      expect(requestedExperiments()).toEqual([EXPERIMENT_ID]);
    });

    it('links back to the experiment page', async () => {
      renderPage(`?experiment=${EXPERIMENT_ID}`);

      const link = await screen.findByRole('link', { name: /See experiment/ });
      expect(link.getAttribute('href')).toBe(`/experiments/${EXPERIMENT_ID}`);
    });
  });

  describe('when no experiment is selected', () => {
    it('does not show the "See experiment" link', async () => {
      renderPage();

      await screen.findByText(/third question/);
      expect(screen.queryByRole('link', { name: /See experiment/ })).toBeNull();
    });
  });

  describe('when ?experiment does not match any experiment', () => {
    it('shows an empty queue without fetching results', async () => {
      renderPage('?experiment=unknown');

      await screen.findByText('No items to review');
      expect(resultRequests).toEqual([]);
    });
  });

  describe('when the user removes the experiment chip', () => {
    it('clears ?experiment and shows every queue', async () => {
      const { router } = renderPage(`?experiment=${EXPERIMENT_ID}`);

      await screen.findByRole('group', { name: `Experiment ${experiment.name}` });
      fireEvent.click(screen.getByRole('button', { name: 'Remove Experiment filter' }));

      await waitFor(() => expect(router.state.location.search).toBe(''));
      await screen.findByText(/third question/);
      await screen.findByText(/other question/);
    });
  });

  describe('when the user picks the "Completed" status', () => {
    it('shows reviewed items instead of the queue, as a Status chip', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/:experimentId/results`, ({ params }) =>
          HttpResponse.json({
            results: params.experimentId === EXPERIMENT_ID ? [results[2], { ...results[0], status: 'complete' }] : [],
            pagination: { total: 2, page: 0, perPage: 100, hasMore: false },
          }),
        ),
      );
      renderPage();

      await screen.findByText(/third question/);
      expect(screen.queryByText(/first question/)).toBeNull();

      await pickFilter('Status', 'Completed');

      await screen.findByRole('group', { name: 'Status Completed' });
      await screen.findByText(/first question/);
      expect(screen.queryByText(/third question/)).toBeNull();
    });
  });

  describe('when the user picks a tag', () => {
    it('narrows the queue to items carrying that tag', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/datasets/${DATASET_ID}/experiments/:experimentId/results`, ({ params }) =>
          HttpResponse.json({
            results:
              params.experimentId === EXPERIMENT_ID ? [results[2], { ...results[1], status: 'needs-review' }] : [],
            pagination: { total: 2, page: 0, perPage: 100, hasMore: false },
          }),
        ),
      );
      renderPage();

      await screen.findByText(/third question/);
      await screen.findByText(/second question/);

      await pickFilter('Tag', 'alpha');

      await screen.findByRole('group', { name: 'Tag alpha' });
      await waitFor(() => expect(screen.queryByText(/third question/)).toBeNull());
      expect(screen.getByText(/second question/)).toBeTruthy();
    });
  });

  describe('when the user picks another experiment', () => {
    it('updates ?experiment and drops ?review', async () => {
      const { router } = renderPage(`?experiment=${EXPERIMENT_ID}&review=res-3`);

      await screen.findByRole('group', { name: `Experiment ${experiment.name}` });
      fireEvent.click(screen.getByRole('button', { name: 'Remove Experiment filter' }));
      await waitFor(() => expect(router.state.location.search).toBe(''));
      await pickExperiment(otherExperiment.name);

      await waitFor(() => {
        expect(router.state.location.search).toBe(`?experiment=${OTHER_EXPERIMENT_ID}`);
      });
      await screen.findByText(/other question/);
    });
  });

  describe('when ?targetType and ?targetId are set', () => {
    it('forwards them to the experiments request', async () => {
      const experimentQueries: URLSearchParams[] = [];
      server.use(
        http.get(`${TEST_BASE_URL}/api/experiments`, ({ request }) => {
          experimentQueries.push(new URL(request.url).searchParams);
          return HttpResponse.json(experimentsResponse);
        }),
      );

      renderPage('?targetType=agent&targetId=agent-1');

      await screen.findByText(/third question/);
      const lastQuery = experimentQueries.at(-1)!;
      expect(lastQuery.get('targetType')).toBe('agent');
      expect(lastQuery.get('targetId')).toBe('agent-1');
    });

    it('keeps the target params when picking an experiment', async () => {
      const { router } = renderPage('?targetType=agent&targetId=agent-1');

      await screen.findByText(/third question/);
      await pickExperiment(otherExperiment.name);

      await waitFor(() => {
        const params = new URLSearchParams(router.state.location.search);
        expect(params.get('experiment')).toBe(OTHER_EXPERIMENT_ID);
        expect(params.get('targetType')).toBe('agent');
        expect(params.get('targetId')).toBe('agent-1');
      });
    });
  });

  describe('when ?review names a result of the selected experiment', () => {
    it('opens that result in the review dialog', async () => {
      renderPage(`?experiment=${EXPERIMENT_ID}&review=res-3`);

      const dialog = await screen.findByRole('dialog', { name: 'Review item res-3' });
      expect(dialog.textContent).toContain('third question');
    });
  });
});
