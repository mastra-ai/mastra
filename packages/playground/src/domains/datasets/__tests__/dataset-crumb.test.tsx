// @vitest-environment jsdom
import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DatasetCrumb, DatasetSwitcherAction } from '../dataset-crumb';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const datasets = [
  { id: 'ds-1', name: 'Weather evals', version: 1 },
  { id: 'ds-2', name: 'Support evals', version: 1 },
];

beforeEach(() => {
  server.use(
    http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json({ datasets, pagination: { total: 2, page: 0 } })),
  );
});

afterEach(() => cleanup());

// Mirrors how RouteHeader mounts the crumb: label as span/link, switcher in `action`.
const renderCrumb = ({ isCurrent }: { isCurrent: boolean }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const crumb = (
    <Breadcrumb>
      <Crumb
        as={isCurrent ? 'span' : Link}
        to={isCurrent ? undefined : '/datasets/ds-1'}
        isCurrent={isCurrent}
        action={<DatasetSwitcherAction />}
      >
        <DatasetCrumb />
      </Crumb>
    </Breadcrumb>
  );
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TestLinkProvider>
          <MemoryRouter initialEntries={['/datasets/ds-1/items/item-1']}>
            <Routes>
              <Route path="/datasets/:datasetId/items/:itemId" element={crumb} />
            </Routes>
          </MemoryRouter>
        </TestLinkProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

describe('DatasetCrumb', () => {
  it('renders the dataset name as a link to the dataset page on nested routes', async () => {
    renderCrumb({ isCurrent: false });

    const link = await screen.findByRole('link', { name: 'Weather evals' });
    expect(link.getAttribute('href')).toBe('/datasets/ds-1');
  });

  it('renders the dataset name as plain text on the dataset page itself', async () => {
    renderCrumb({ isCurrent: true });

    const label = await screen.findByText('Weather evals', { ignore: '.sr-only' });
    expect(label.closest('[aria-current="page"]')).not.toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('opens the dataset switcher only from the arrow trigger', async () => {
    renderCrumb({ isCurrent: false });

    await screen.findByRole('link', { name: 'Weather evals' });
    expect(screen.queryByPlaceholderText('Search datasets...')).toBeNull();

    fireEvent.click(screen.getByRole('combobox', { name: 'Switch dataset' }));

    expect(await screen.findByPlaceholderText('Search datasets...')).toBeDefined();
    expect(screen.getByText('Support evals')).toBeDefined();
  });
});
