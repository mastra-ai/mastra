import type { DatasetRecord } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { DatasetsList } from '../datasets-list';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const dataset = (id: string, name: string): DatasetRecord => ({
  id,
  name,
  version: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
});

const datasets = [dataset('ds-a', 'Dataset A'), dataset('ds-b', 'Dataset B'), dataset('ds-c', 'Dataset C')];

const renderList = () =>
  renderWithProviders(
    <TestLinkProvider>
      <DatasetsList datasets={datasets} experiments={[]} isLoading={false} />
    </TestLinkProvider>,
  );

describe('DatasetsList keyboard navigation', () => {
  it('applies a roving tabindex to dataset rows', () => {
    renderList();

    const rows = interactiveRows();
    expect(rows).toHaveLength(3);
    // The RowWrapper is the focus target; the link inside is out of the tab order.
    expect(rows.every(row => row.tagName === 'DIV')).toBe(true);
    expect(rows.every(row => row.querySelector('a')?.tabIndex === -1)).toBe(true);
    expectRovingTabindex(rows);
  });

  it('moves focus with ArrowDown/ArrowUp and jumps with Home/End', () => {
    renderList();

    expectArrowNavigation(interactiveRows());
  });

  it('keeps row links navigable (href preserved on the inner link)', () => {
    renderList();

    expect(interactiveRows().map(row => row.querySelector('a')?.getAttribute('href'))).toEqual([
      '/datasets/ds-a',
      '/datasets/ds-b',
      '/datasets/ds-c',
    ]);
  });
});
