import type { DatasetExperimentResult } from '@mastra/client-js';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Outlet } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ExperimentItemPanelProvider, useExperimentItemPanel } from './experiment-item-panel-context';

const makeResult = (id: string, itemId: string): DatasetExperimentResult => ({
  id,
  experimentId: 'exp-1',
  itemId,
  itemDatasetVersion: 1,
  input: 'q',
  output: 'a',
  groundTruth: null,
  error: null,
  startedAt: '2026-08-25T10:00:00.000Z',
  completedAt: '2026-08-25T10:00:01.000Z',
  retryCount: 0,
  traceId: null,
  status: null,
  tags: null,
  scores: [],
  createdAt: '2026-08-25T10:00:00.000Z',
});

const results = [makeResult('r1', 'item-1'), makeResult('r2', 'item-2'), makeResult('r3', 'item-3')];

function Probe() {
  const panel = useExperimentItemPanel();
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
        path: '/experiments/:experimentId',
        element: (
          <ExperimentItemPanelProvider experimentId="exp-1" datasetId="ds-1" results={results} isLoadingResults={false}>
            <Probe />
            <Outlet />
          </ExperimentItemPanelProvider>
        ),
        children: [{ path: 'items/:itemId', element: null }],
      },
    ],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
  return router;
};

describe('experiment item panel context', () => {
  it('exposes no current item on the list route', () => {
    renderWithRouter('/experiments/exp-1');
    expect(screen.getByTestId('current-item').textContent).toBe('none');
  });

  it('derives the current item id from the items child route', () => {
    renderWithRouter('/experiments/exp-1/items/item-2');
    expect(screen.getByTestId('current-item').textContent).toBe('item-2');
  });

  it('openItem navigates to the item URL', async () => {
    const router = renderWithRouter('/experiments/exp-1');
    fireEvent.click(screen.getByText('open'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/experiments/exp-1/items/item-2'));
  });

  it('close navigates back to the experiment URL', async () => {
    const router = renderWithRouter('/experiments/exp-1/items/item-2');
    fireEvent.click(screen.getByText('close'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/experiments/exp-1'));
  });

  it('goToNextItem navigates to the next loaded item', async () => {
    const router = renderWithRouter('/experiments/exp-1/items/item-2');
    fireEvent.click(screen.getByText('next'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/experiments/exp-1/items/item-3'));
  });

  it('goToPreviousItem navigates to the previous loaded item', async () => {
    const router = renderWithRouter('/experiments/exp-1/items/item-2');
    fireEvent.click(screen.getByText('previous'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/experiments/exp-1/items/item-1'));
  });

  it('is undefined at the boundaries', () => {
    renderWithRouter('/experiments/exp-1/items/item-1');
    expect(screen.getByTestId('has-previous').textContent).toBe('no');
    expect(screen.getByTestId('has-next').textContent).toBe('yes');
  });

  it('is undefined at the end boundary', () => {
    renderWithRouter('/experiments/exp-1/items/item-3');
    expect(screen.getByTestId('has-next').textContent).toBe('no');
    expect(screen.getByTestId('has-previous').textContent).toBe('yes');
  });

  it('throws when used outside the provider', () => {
    expect(() => render(<Probe />)).toThrow(/within an ExperimentItemPanelProvider/);
  });

  describe('window keyboard navigation', () => {
    it('navigates with PageDown/PageUp and closes with Escape while an item is open', async () => {
      const router = renderWithRouter('/experiments/exp-1/items/item-2');

      fireEvent.keyDown(document.body, { key: 'PageDown' });
      await waitFor(() => expect(router.state.location.pathname).toBe('/experiments/exp-1/items/item-3'));

      fireEvent.keyDown(document.body, { key: 'PageUp' });
      await waitFor(() => expect(router.state.location.pathname).toBe('/experiments/exp-1/items/item-2'));

      fireEvent.keyDown(document.body, { key: 'Escape' });
      await waitFor(() => expect(router.state.location.pathname).toBe('/experiments/exp-1'));
    });

    it('is inert when no item is open', () => {
      const router = renderWithRouter('/experiments/exp-1');
      fireEvent.keyDown(document.body, { key: 'PageDown' });
      expect(router.state.location.pathname).toBe('/experiments/exp-1');
    });

    it('ignores keys coming from an editable element', () => {
      const router = renderWithRouter('/experiments/exp-1/items/item-2');
      const input = document.createElement('input');
      document.body.appendChild(input);
      fireEvent.keyDown(input, { key: 'PageDown' });
      input.remove();
      expect(router.state.location.pathname).toBe('/experiments/exp-1/items/item-2');
    });
  });
});
