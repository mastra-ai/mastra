import type { DatasetItem } from '@mastra/client-js';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Outlet } from 'react-router';
import { describe, expect, it } from 'vitest';

import { DatasetItemPanelProvider, useDatasetItemPanel } from './dataset-item-panel-context';

const makeItem = (id: string): DatasetItem => ({
  id,
  datasetId: 'ds-1',
  datasetVersion: 1,
  input: { q: 'question' },
  createdAt: '2026-08-25T10:00:00.000Z',
  updatedAt: '2026-08-25T10:00:00.000Z',
});

const items = [makeItem('item-1'), makeItem('item-2'), makeItem('item-3')];

function Probe() {
  const panel = useDatasetItemPanel();
  return (
    <div>
      <span data-testid="current-item">{panel.currentItemId ?? 'none'}</span>
      <span data-testid="has-previous">{panel.goToPreviousItem ? 'yes' : 'no'}</span>
      <span data-testid="has-next">{panel.goToNextItem ? 'yes' : 'no'}</span>
      <button onClick={() => panel.openItem('item-2')}>open</button>
      <button onClick={panel.close}>close</button>
      <button onClick={panel.goToPreviousItem} disabled={!panel.goToPreviousItem}>
        previous
      </button>
      <button onClick={panel.goToNextItem} disabled={!panel.goToNextItem}>
        next
      </button>
    </div>
  );
}

const renderWithRouter = (initialPath: string) => {
  const router = createMemoryRouter(
    [
      {
        path: '/datasets/:datasetId',
        element: (
          <DatasetItemPanelProvider datasetId="ds-1" items={items} isLoadingItems={false}>
            <Probe />
            <Outlet />
          </DatasetItemPanelProvider>
        ),
        children: [{ path: 'items/:itemId', element: null }],
      },
    ],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
  return router;
};

describe('dataset item panel context', () => {
  it('exposes no current item on the list route', () => {
    renderWithRouter('/datasets/ds-1');
    expect(screen.getByTestId('current-item').textContent).toBe('none');
  });

  it('derives the current item id from the items child route', () => {
    renderWithRouter('/datasets/ds-1/items/item-2');
    expect(screen.getByTestId('current-item').textContent).toBe('item-2');
  });

  it('openItem navigates to the item URL', async () => {
    const router = renderWithRouter('/datasets/ds-1');
    fireEvent.click(screen.getByText('open'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/datasets/ds-1/items/item-2'));
  });

  it('close navigates back to the dataset URL', async () => {
    const router = renderWithRouter('/datasets/ds-1/items/item-2');
    fireEvent.click(screen.getByText('close'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/datasets/ds-1'));
  });

  it('goToNextItem navigates to the next loaded item', async () => {
    const router = renderWithRouter('/datasets/ds-1/items/item-2');
    fireEvent.click(screen.getByText('next'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/datasets/ds-1/items/item-3'));
  });

  it('goToPreviousItem navigates to the previous loaded item', async () => {
    const router = renderWithRouter('/datasets/ds-1/items/item-2');
    fireEvent.click(screen.getByText('previous'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/datasets/ds-1/items/item-1'));
  });

  it('is undefined at the boundaries', () => {
    renderWithRouter('/datasets/ds-1/items/item-1');
    expect(screen.getByTestId('has-previous').textContent).toBe('no');
    expect(screen.getByTestId('has-next').textContent).toBe('yes');
  });

  it('is undefined at the end boundary', () => {
    renderWithRouter('/datasets/ds-1/items/item-3');
    expect(screen.getByTestId('has-next').textContent).toBe('no');
    expect(screen.getByTestId('has-previous').textContent).toBe('yes');
  });

  it('throws when used outside the provider', () => {
    expect(() => render(<Probe />)).toThrow(/within a DatasetItemPanelProvider/);
  });

  describe('window keyboard navigation', () => {
    it('navigates with PageDown/PageUp and closes with Escape while an item is open', async () => {
      const router = renderWithRouter('/datasets/ds-1/items/item-2');

      fireEvent.keyDown(document.body, { key: 'PageDown' });
      await waitFor(() => expect(router.state.location.pathname).toBe('/datasets/ds-1/items/item-3'));

      fireEvent.keyDown(document.body, { key: 'PageUp' });
      await waitFor(() => expect(router.state.location.pathname).toBe('/datasets/ds-1/items/item-2'));

      fireEvent.keyDown(document.body, { key: 'Escape' });
      await waitFor(() => expect(router.state.location.pathname).toBe('/datasets/ds-1'));
    });

    it('is inert when no item is open', () => {
      const router = renderWithRouter('/datasets/ds-1');
      fireEvent.keyDown(document.body, { key: 'PageDown' });
      expect(router.state.location.pathname).toBe('/datasets/ds-1');
    });

    it('ignores keys coming from an editable element', () => {
      const router = renderWithRouter('/datasets/ds-1/items/item-2');
      const input = document.createElement('input');
      document.body.appendChild(input);
      fireEvent.keyDown(input, { key: 'PageDown' });
      input.remove();
      expect(router.state.location.pathname).toBe('/datasets/ds-1/items/item-2');
    });
  });
});
