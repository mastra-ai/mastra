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
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

// Base UI popups don't open in jsdom; a native select exposes the same contract.
vi.mock('@mastra/playground-ui/components/Combobox', () => ({
  Combobox: ({
    options,
    value,
    onValueChange,
    placeholder,
  }: {
    options: Array<{ label: string; value: string }>;
    value?: string | string[];
    onValueChange?: (value: string) => void;
    placeholder?: string;
  }) => (
    <select
      aria-label={placeholder}
      value={Array.isArray(value) ? (value[0] ?? '') : (value ?? '')}
      onChange={event => onValueChange?.(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

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

const renderPage = (search = '') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/experiments/review-queue', element: <ReviewQueuePage /> }], {
    initialEntries: [`/experiments/review-queue${search}`],
  });

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

      const select = (await screen.findByRole('combobox')) as HTMLSelectElement;
      await screen.findByRole('option', { name: 'All experiments' });
      expect(select.value).toBe('all');

      await screen.findByText(/third question/);
      await screen.findByText(/other question/);
      expect(requestedExperiments()).toEqual([EXPERIMENT_ID, OTHER_EXPERIMENT_ID]);
    });
  });

  describe('when ?experiment points at a loaded experiment', () => {
    it('preselects it in the combobox and shows only its review queue', async () => {
      renderPage(`?experiment=${EXPERIMENT_ID}`);

      const select = (await screen.findByRole('combobox')) as HTMLSelectElement;
      await waitFor(() => expect(select.value).toBe(EXPERIMENT_ID));

      await screen.findByText(/third question/);
      expect(screen.queryByText(/other question/)).toBeNull();
      expect(requestedExperiments()).toEqual([EXPERIMENT_ID]);
    });
  });

  describe('when ?experiment does not match any experiment', () => {
    it('shows an empty queue without fetching results', async () => {
      renderPage('?experiment=unknown');

      await screen.findByText('No items to review');
      expect(resultRequests).toEqual([]);
    });
  });

  describe('when the user picks "All experiments"', () => {
    it('clears ?experiment and shows every queue', async () => {
      const { router } = renderPage(`?experiment=${EXPERIMENT_ID}`);

      const select = await screen.findByRole('combobox');
      await screen.findByRole('option', { name: 'All experiments' });
      fireEvent.change(select, { target: { value: 'all' } });

      await waitFor(() => expect(router.state.location.search).toBe(''));
      await screen.findByText(/third question/);
      await screen.findByText(/other question/);
    });
  });

  describe('when the user picks another experiment', () => {
    it('updates ?experiment and drops ?review', async () => {
      const { router } = renderPage(`?experiment=${EXPERIMENT_ID}&review=res-3`);

      const select = await screen.findByRole('combobox');
      await screen.findByRole('option', { name: 'entity-extraction / model-b' });
      fireEvent.change(select, { target: { value: OTHER_EXPERIMENT_ID } });

      await waitFor(() => {
        expect(router.state.location.search).toBe(`?experiment=${OTHER_EXPERIMENT_ID}`);
      });
      await screen.findByText(/other question/);
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
