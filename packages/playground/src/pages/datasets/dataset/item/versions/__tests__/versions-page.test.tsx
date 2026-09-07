// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import DatasetItemVersionsComparePage from '../index';
import { dataset, history } from './fixtures/versions-page';
import { RouteHeaderActionsProvider, RouteHeaderActionsSlot } from '@/lib/route-header/route-header-actions';
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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

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
              <Route
                path="/datasets/:datasetId/items/:itemId/versions"
                element={
                  <RouteHeaderActionsProvider>
                    <RouteHeaderActionsSlot />
                    <DatasetItemVersionsComparePage />
                    <LocationProbe />
                  </RouteHeaderActionsProvider>
                }
              />
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

  describe('given ?view=diff with two versions selected', () => {
    it('keeps the exact same two-card layout and only highlights changed lines in the editors', async () => {
      const { container } = renderPage('/datasets/ds-1/items/item-a/versions?version=2&compare=1&view=diff');

      await waitFor(() => expect(container.querySelector('.cm-diff-removed')).not.toBeNull());
      expect(container.querySelector('.cm-diff-added')).not.toBeNull();
      expect(container.querySelector('.cm-mergeView')).toBeNull();
      expect(screen.getByRole('combobox', { name: 'Version' })).toBeDefined();
      expect(screen.getByRole('combobox', { name: 'Compare version' })).toBeDefined();
      expect(screen.getByRole('button', { name: /Default View/ })).toBeDefined();
      expect(screen.getAllByText('Input')).toHaveLength(2);
      expect(screen.getAllByText('Tool Mocks')).toHaveLength(2);
      expect(screen.queryByText('No version selected')).toBeNull();
    });

    it('colours by chronology: the newer version shows additions (green), the older one removals (red)', async () => {
      // Left = v2 (newer), right = v1 (older)
      const { container } = renderPage('/datasets/ds-1/items/item-a/versions?version=2&compare=1&view=diff');
      await waitFor(() => expect(container.querySelector('.cm-diff-removed')).not.toBeNull());

      const grid = container.querySelector('.md\\:grid-cols-2')!;
      const [leftCard, rightCard] = Array.from(grid.children);
      expect(leftCard.querySelector('.cm-diff-added')).not.toBeNull();
      expect(leftCard.querySelector('.cm-diff-removed')).toBeNull();
      expect(rightCard.querySelector('.cm-diff-removed')).not.toBeNull();
      expect(rightCard.querySelector('.cm-diff-added')).toBeNull();
    });
  });

  describe('given the Diff View button is clicked', () => {
    it('stores ?view=diff in the URL and highlights the changes', async () => {
      const { container } = renderPage('/datasets/ds-1/items/item-a/versions?version=2&compare=1');
      expect(container.querySelector('.cm-diff-removed')).toBeNull();

      fireEvent.click(await screen.findByRole('button', { name: /Diff View/ }));

      await waitFor(() => expect(container.querySelector('.cm-diff-removed')).not.toBeNull());
      expect(container.querySelector('.cm-diff-added')).not.toBeNull();
      expect(screen.getByTestId('location').textContent).toContain('view=diff');
    });
  });
});
