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
        sort={{ column: 'spend', direction: 'asc' }}
        onSortChange={onSortChange}
      />,
    );
    expect(names()).toEqual(['gemini-2.5-pro', 'gpt-5', 'claude-sonnet-4.5']);

    fireEvent.click(screen.getByRole('button', { name: 'Spend' }));
    expect(onSortChange).toHaveBeenCalledWith({ column: 'spend', direction: 'desc' });
    // Still the controlled order until the owner passes the new sort.
    expect(names()).toEqual(['gemini-2.5-pro', 'gpt-5', 'claude-sonnet-4.5']);
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
    expect(screen.getByText('Nothing in this range.')).toBeDefined();
  });
});
