// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { MetricsShareList } from './metrics-share-list';
import type { MetricsShareListProps, MetricsShareListRow, MetricsShareListSort } from './metrics-share-list-types';

/** Three agents: most runs, most cost and an unpriced one. */
const rows: MetricsShareListRow[] = [
  { key: 'busy', label: 'busy', share: 600, value: '600', cells: ['$1'], sortValues: { runs: 600, cost: 1 } },
  { key: 'pricey', label: 'pricey', share: 300, value: '300', cells: ['$9'], sortValues: { runs: 300, cost: 9 } },
  { key: 'unpriced', label: 'unpriced', share: 100, value: '100', cells: ['—'], sortValues: { runs: 100 } },
];

const columns = [{ label: 'Cost', sortKey: 'cost' }];

/** The list with its sort held in state, as a card holds it. */
function SortedList(props: Partial<MetricsShareListProps>) {
  const [sort, setSort] = useState<MetricsShareListSort>({ key: 'runs', direction: 'descending' });
  return (
    <MetricsShareList
      rows={rows}
      columns={columns}
      valueLabel="Runs"
      valueSortKey="runs"
      sort={sort}
      onSortChange={setSort}
      overflow="more"
      limit={10}
      {...props}
    />
  );
}

const order = () => screen.getAllByRole('listitem').map(li => li.querySelector('[title]')?.getAttribute('title'));
const swatches = () =>
  Object.fromEntries(
    screen
      .getAllByRole('listitem')
      .map(li => [li.querySelector('[title]')?.getAttribute('title'), li.querySelector('span')?.style.backgroundColor]),
  );
const segments = (container: HTMLElement) =>
  within(container)
    .getAllByTestId('metrics-share-segment')
    .map(s => s.style.flex);
const header = (name: string) => screen.getByRole('columnheader', { name });

describe('MetricsShareList sorting', () => {
  afterEach(() => cleanup());

  describe('when sorted by the value column', () => {
    it('lists rows by share and marks that header as sorted', () => {
      render(<SortedList />);
      expect(order()).toEqual(['busy', 'pricey', 'unpriced']);
      expect(header('Runs').getAttribute('aria-sort')).toBe('descending');
      expect(header('Cost').getAttribute('aria-sort')).toBe('none');
    });
  });

  describe('when another column header is clicked', () => {
    it('sorts by that column, largest first, with rows that have no value last', () => {
      render(<SortedList />);
      fireEvent.click(within(header('Cost')).getByRole('button'));
      expect(order()).toEqual(['pricey', 'busy', 'unpriced']);
      expect(header('Cost').getAttribute('aria-sort')).toBe('descending');
    });

    it('sorts smallest first on a second click, still with rows that have no value last', () => {
      render(<SortedList />);
      fireEvent.click(within(header('Cost')).getByRole('button'));
      fireEvent.click(within(header('Cost')).getByRole('button'));
      expect(order()).toEqual(['busy', 'pricey', 'unpriced']);
      expect(header('Cost').getAttribute('aria-sort')).toBe('ascending');
    });

    it('keeps each row’s colour and the strip, which always show share', ({ expect }) => {
      const { container } = render(<SortedList />);
      const colours = swatches();
      const strip = segments(container);
      fireEvent.click(within(header('Cost')).getByRole('button'));
      expect(swatches()).toEqual(colours);
      expect(segments(container)).toEqual(strip);
    });
  });

  describe('when rows carry their own colour', () => {
    it('paints them with it', () => {
      render(
        <SortedList rows={rows.map(r => (r.key === 'pricey' ? { ...r, color: 'rgb(1, 2, 3)' } : r))} palette="hues" />,
      );
      expect(swatches().pricey).toBe('rgb(1, 2, 3)');
    });
  });

  describe('when the list has no sort handler', () => {
    it('renders plain headers without buttons', () => {
      render(<MetricsShareList rows={rows} columns={columns} valueLabel="Runs" />);
      expect(screen.queryByRole('button', { name: /Cost/ })).toBeNull();
      expect(screen.queryByRole('columnheader')).toBeNull();
    });
  });
});
