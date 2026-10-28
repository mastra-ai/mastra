// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MetricsTable } from './metrics-table';
import type { MetricsTableColumn } from './metrics-table-types';

type Row = { name: string; spend: number };

const rows: Row[] = [
  { name: 'gpt-5', spend: 30 },
  { name: 'claude-sonnet-4.5', spend: 120 },
  { name: 'gemini-2.5-pro', spend: 6 },
];

const columns: MetricsTableColumn<Row>[] = [
  {
    id: 'name',
    header: 'Model',
    width: 'minmax(0,1fr)',
    cell: r => r.name,
    sortValue: r => r.name,
    firstDirection: 'asc',
  },
  { id: 'spend', header: 'Spend', align: 'end', cell: r => `$${r.spend}`, sortValue: r => r.spend },
];

const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map(r => within(r).getAllByRole('cell')[0].textContent);

describe('MetricsTable', () => {
  afterEach(() => cleanup());

  it('keeps the given order until a sort is set, then sorts by the column', () => {
    render(<MetricsTable columns={columns} rows={rows} getRowKey={r => r.name} />);
    expect(names()).toEqual(['gpt-5', 'claude-sonnet-4.5', 'gemini-2.5-pro']);

    fireEvent.click(screen.getByRole('button', { name: 'Spend' }));
    expect(names()).toEqual(['claude-sonnet-4.5', 'gpt-5', 'gemini-2.5-pro']);
    expect(screen.getByRole('columnheader', { name: 'Spend' }).getAttribute('aria-sort')).toBe('descending');

    fireEvent.click(screen.getByRole('button', { name: 'Spend' }));
    expect(names()).toEqual(['gemini-2.5-pro', 'gpt-5', 'claude-sonnet-4.5']);

    // A name column starts A to Z.
    fireEvent.click(screen.getByRole('button', { name: 'Model' }));
    expect(names()).toEqual(['claude-sonnet-4.5', 'gemini-2.5-pro', 'gpt-5']);
  });

  it('follows a controlled sort and reports the next one', () => {
    const onSortChange = vi.fn();
    render(
      <MetricsTable
        columns={columns}
        rows={rows}
        getRowKey={r => r.name}
        sort={{ column: 'spend', direction: 'desc' }}
        onSortChange={onSortChange}
      />,
    );
    expect(names()).toEqual(['claude-sonnet-4.5', 'gpt-5', 'gemini-2.5-pro']);

    fireEvent.click(screen.getByRole('button', { name: 'Spend' }));
    expect(onSortChange).toHaveBeenCalledWith({ column: 'spend', direction: 'asc' });
    // Still the controlled order until the owner passes the new sort.
    expect(names()).toEqual(['claude-sonnet-4.5', 'gpt-5', 'gemini-2.5-pro']);
  });

  it('reports row hover and click, by mouse and keyboard, without scrolling on Space', () => {
    const onRowClick = vi.fn();
    const onRowHover = vi.fn();
    render(
      <MetricsTable
        columns={columns}
        rows={rows}
        getRowKey={r => r.name}
        onRowClick={onRowClick}
        onRowHover={onRowHover}
        rowTitle={() => 'Hide this line'}
      />,
    );
    const row = screen.getAllByTitle('Hide this line')[0];

    fireEvent.mouseEnter(row);
    expect(onRowHover).toHaveBeenLastCalledWith(rows[0]);
    fireEvent.mouseLeave(row);
    expect(onRowHover).toHaveBeenLastCalledWith(undefined);

    fireEvent.click(row);
    const space = fireEvent.keyDown(row, { key: ' ' });
    expect(space).toBe(false);
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledTimes(3);
  });

  it('leaves clicks and keys on a control inside a cell to that control', () => {
    const onRowClick = vi.fn();
    render(
      <MetricsTable
        columns={[{ id: 'name', header: 'Model', cell: r => <a href={`#${r.name}`}>{r.name}</a> }]}
        rows={rows}
        getRowKey={r => r.name}
        onRowClick={onRowClick}
      />,
    );
    const link = screen.getByRole('link', { name: 'gpt-5' });

    fireEvent.click(link);
    const enter = fireEvent.keyDown(link, { key: 'Enter' });
    expect(enter).toBe(true);
    expect(onRowClick).not.toHaveBeenCalled();

    // The row's own padding still counts as the row.
    fireEvent.click(screen.getAllByRole('row')[1]);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it('shows the empty message when there are no rows', () => {
    render(<MetricsTable columns={columns} rows={[]} getRowKey={r => r.name} empty="Nothing in this range." />);
    expect(screen.getByRole('cell', { name: 'Nothing in this range.' })).toBeDefined();
  });

  it('pages rows by pageSize, sorting across every page, and goes back to the first page on a new sort', () => {
    const many: Row[] = Array.from({ length: 12 }, (_, i) => ({ name: `m${i}`, spend: i }));
    render(<MetricsTable columns={columns} rows={many} getRowKey={r => r.name} pageSize={5} />);
    expect(names()).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);

    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(names()).toEqual(['m10', 'm11']);

    fireEvent.click(screen.getByRole('button', { name: 'Spend' }));
    expect(names()).toEqual(['m11', 'm10', 'm9', 'm8', 'm7']);
  });

  it('shows no pagination when every row fits one page', () => {
    render(<MetricsTable columns={columns} rows={rows} getRowKey={r => r.name} pageSize={5} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('shows skeleton rows under the real header while loading, instead of rows or the empty message', () => {
    render(<MetricsTable columns={columns} rows={[]} getRowKey={r => r.name} pageSize={4} isLoading empty="Nothing" />);
    expect(screen.getByRole('columnheader', { name: 'Model' })).toBeDefined();
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(4);
    expect(screen.queryByText('Nothing')).toBeNull();
  });

  it('explains a column in a tooltip on its header, which screen readers read as its description', () => {
    render(
      <MetricsTable
        columns={[
          ...columns,
          { id: 'change', header: '% Change', cell: () => '+1%', description: 'Against last week' },
        ]}
        rows={rows}
        getRowKey={r => r.name}
      />,
    );
    // Not sortable, so a focusable label rather than a button; no separate info icon.
    const header = screen.getByText('% Change').parentElement;
    const id = header?.getAttribute('aria-describedby');
    expect(header?.getAttribute('tabindex')).toBe('0');
    expect(id && document.getElementById(id)?.textContent).toBe('Against last week');
    expect(screen.queryByRole('button', { name: /About/ })).toBeNull();
  });

  it('highlights the active row', () => {
    render(
      <MetricsTable columns={columns} rows={rows} getRowKey={r => r.name} isRowActive={r => r.name === 'gpt-5'} />,
    );
    const [, first, second] = screen.getAllByRole('row');
    expect(first?.getAttribute('aria-current')).toBe('true');
    expect(second?.hasAttribute('aria-current')).toBe(false);
  });

  it('turns the sort off on a third click: back to the given order, or to defaultSort', () => {
    const onSortChange = vi.fn();
    const { unmount } = render(
      <MetricsTable columns={columns} rows={rows} getRowKey={r => r.name} onSortChange={onSortChange} />,
    );
    const spend = () => screen.getByRole('button', { name: 'Spend' });
    fireEvent.click(spend());
    expect(names()).toEqual(['claude-sonnet-4.5', 'gpt-5', 'gemini-2.5-pro']);
    fireEvent.click(spend());
    expect(names()).toEqual(['gemini-2.5-pro', 'gpt-5', 'claude-sonnet-4.5']);
    fireEvent.click(spend());
    expect(names()).toEqual(['gpt-5', 'claude-sonnet-4.5', 'gemini-2.5-pro']);
    expect(onSortChange).toHaveBeenLastCalledWith(undefined);
    unmount();

    render(
      <MetricsTable
        columns={columns}
        rows={rows}
        getRowKey={r => r.name}
        defaultSort={{ column: 'spend', direction: 'desc' }}
      />,
    );
    const model = () => screen.getByRole('button', { name: 'Model' });
    fireEvent.click(model());
    fireEvent.click(model());
    fireEvent.click(model());
    expect(names()).toEqual(['claude-sonnet-4.5', 'gpt-5', 'gemini-2.5-pro']);
  });
});
