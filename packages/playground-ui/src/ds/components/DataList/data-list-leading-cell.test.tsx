// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DataList } from './data-list';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

/** A selectable list: a leading checkbox column, then a group of reorderable/resizable columns. */
const SelectableList = () => (
  <DataList
    columns="2rem 100px 200px auto"
    id="selectable"
    columnKeys={['select', 'name', 'status', 'date']}
    reorderable
    resizable
  >
    <DataList.Top hasLeadingCell>
      <DataList.TopSelectCell checked={false} onToggle={() => {}} aria-label="Select all" />
      <DataList.TopCells colStart={2}>
        <DataList.TopCell>Name</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>Date</DataList.TopCell>
      </DataList.TopCells>
    </DataList.Top>
    <DataList.RowWrapper>
      <DataList.SelectCell checked={false} onToggle={() => {}} aria-label="Select a" />
      <DataList.RowButton colStart={2}>
        <DataList.Cell>a</DataList.Cell>
        <DataList.Cell>ok</DataList.Cell>
        <DataList.Cell>today</DataList.Cell>
      </DataList.RowButton>
    </DataList.RowWrapper>
  </DataList>
);

const getGrid = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[style*="grid-template-columns"]') as HTMLElement;

const headerCell = (text: string) => screen.getByText(text).closest<HTMLElement>('[draggable]') as HTMLElement;

describe('DataList with a leading selection cell', () => {
  it('keeps the selection column out of reordering and resizing', () => {
    render(<SelectableList />);
    expect(screen.getByLabelText('Select all').closest('[draggable]')).toBeNull();
    expect(screen.getAllByRole('separator', { name: 'Resize column' })).toHaveLength(3);
  });

  it('resizes the column the handle belongs to, past the leading cell', () => {
    const { container } = render(<SelectableList />);
    const statusHandle = screen.getAllByRole('separator', { name: 'Resize column' })[1];
    fireEvent.keyDown(statusHandle, { key: 'ArrowRight' });
    expect(getGrid(container).style.gridTemplateColumns).toBe('2rem 100px 216px auto');
  });

  it('reorders grouped columns while the selection column stays first', () => {
    const { container } = render(<SelectableList />);
    fireEvent.keyDown(headerCell('Date'), { key: 'ArrowLeft', altKey: true });
    expect(getGrid(container).style.gridTemplateColumns).toBe('2rem 100px auto 200px');

    // Rows and header groups are offset by the leading column, so their nth child maps to column n + 1.
    const rules = container.querySelector('style')?.textContent ?? '';
    expect(rules).toContain('.data-list-cells[data-data-list-cells-offset="1"] > :nth-child(3) { order: 2; }');
    expect(rules).toContain('.data-list-cells[data-data-list-cells-offset="1"] > :nth-child(2) { order: 3; }');
  });

  it('never moves a grouped column into the selection slot', () => {
    const { container } = render(<SelectableList />);
    fireEvent.keyDown(headerCell('Name'), { key: 'ArrowLeft', altKey: true });
    expect(getGrid(container).style.gridTemplateColumns).toBe('2rem 100px 200px auto');
  });
});
