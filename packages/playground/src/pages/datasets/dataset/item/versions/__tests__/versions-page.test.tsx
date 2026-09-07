// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import DatasetItemVersionsComparePage from '../index';
import { dataset, history } from './fixtures/versions-page';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

beforeEach(() => {
  server.use(
    http.get(`${BASE_URL}/api/datasets/ds-1`, () => HttpResponse.json(dataset)),
    http.get(`${BASE_URL}/api/datasets/ds-1/items/item-a/history`, () => HttpResponse.json({ history })),
    http.get(`${BASE_URL}/api/datasets/ds-1/items/item-a/versions/:version`, ({ params }) => {
      const version = history.find(v => String(v.datasetVersion) === params.version);
      return version ? HttpResponse.json(version) : new HttpResponse(null, { status: 404 });
    }),
  );
});

afterEach(() => cleanup());

const renderPage = (initialEntry: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TestLinkProvider>
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              <Route path="/datasets/:datasetId/items/:itemId/versions" element={<DatasetItemVersionsComparePage />} />
            </Routes>
          </MemoryRouter>
        </TestLinkProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

describe('DatasetItemVersionsComparePage', () => {
  it('shows an empty compare column when no ?compare is provided', async () => {
    renderPage('/datasets/ds-1/items/item-a/versions');

    expect(await screen.findByRole('combobox', { name: 'Version' })).toBeDefined();
    const compare = await screen.findByRole('combobox', { name: 'Compare version' });
    expect(compare.textContent).toContain('Select a version to compare');
    expect(await screen.findByText('No version selected')).toBeDefined();
    expect(screen.queryByText(/older/)).toBeNull();
  });

  it('pre-selects the version from ?version in the history combobox', async () => {
    renderPage('/datasets/ds-1/items/item-a/versions?version=1');

    const combobox = await screen.findByRole('combobox', { name: 'Version' });
    await waitFor(() => expect(combobox.textContent).toContain('v. 1'));
    expect(await screen.findByText(/older/)).toBeDefined();
  });

  it('defaults the history combobox to the latest version without ?version', async () => {
    renderPage('/datasets/ds-1/items/item-a/versions');

    const combobox = await screen.findByRole('combobox', { name: 'Version' });
    await waitFor(() => expect(combobox.textContent).toContain('v. 2'));
    expect(await screen.findByText(/newer/)).toBeDefined();
  });

  it('shows both versions side by side when ?version and ?compare are provided', async () => {
    renderPage('/datasets/ds-1/items/item-a/versions?version=2&compare=1');

    const compare = await screen.findByRole('combobox', { name: 'Compare version' });
    await waitFor(() => expect(compare.textContent).toContain('v. 1'));
    expect(await screen.findByText(/newer/)).toBeDefined();
    expect(await screen.findByText(/older/)).toBeDefined();
    expect(screen.queryByText('No version selected')).toBeNull();
  });
});
