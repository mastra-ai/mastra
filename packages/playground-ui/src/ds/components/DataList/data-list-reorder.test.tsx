// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataList } from './data-list';
import type { DataListRootProps } from './data-list-root';

const STORAGE_KEY = 'mastra:data-list:column-order:runs';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const List = (props: Partial<DataListRootProps>) => (
  <DataList columns="10rem minmax(0, 1fr) auto" {...props}>
    <DataList.Top>
      <DataList.TopCell sticky="start">Name</DataList.TopCell>
      <DataList.TopCell>Status</DataList.TopCell>
      <DataList.TopCell>Date</DataList.TopCell>
    </DataList.Top>
    <DataList.RowButton>
      <DataList.Cell>a</DataList.Cell>
      <DataList.Cell>ok</DataList.Cell>
      <DataList.Cell>today</DataList.Cell>
    </DataList.RowButton>
  </DataList>
);

const getGrid = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[style*="grid-template-columns"]') as HTMLElement;

function createDataTransfer() {
  const data: Record<string, string> = {};
  return {
    get types() {
      return Object.keys(data);
    },
    setData: (type: string, value: string) => {
      data[type] = value;
    },
    getData: (type: string) => data[type] ?? '',
    effectAllowed: 'all',
    dropEffect: 'none',
  };
}

function drag(source: HTMLElement, target: HTMLElement) {
  const dataTransfer = createDataTransfer();
  fireEvent.dragStart(source, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

describe('DataList reorderable', () => {
  it('leaves the list untouched without reorderable', () => {
    const { container } = render(<List />);
    expect(getGrid(container).style.gridTemplateColumns).toBe('10rem minmax(0, 1fr) auto');
    expect(container.querySelector('[draggable]')).toBeNull();
    expect(container.querySelector('style')).toBeNull();
  });

  it('disables reordering without an id', () => {
    const { container } = render(<List reorderable />);
    expect(container.querySelector('[draggable]')).toBeNull();
  });

  it('makes non-sticky header cells draggable', () => {
    render(<List reorderable id="runs" />);
    expect(screen.getByText('Name').closest('[draggable]')).toBeNull();
    expect(screen.getByText('Status').closest('span[draggable]')).not.toBeNull();
  });

  it('moves a column on drop, persists it and restores it on remount', () => {
    const { container, unmount } = render(<List reorderable id="runs" />);
    const status = screen.getByText('Status').closest<HTMLElement>('[draggable]') as HTMLElement;
    const date = screen.getByText('Date').closest<HTMLElement>('[draggable]') as HTMLElement;

    drag(date, status);

    expect(getGrid(container).style.gridTemplateColumns).toBe('10rem auto minmax(0, 1fr)');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual([0, 2, 1]);
    expect(container.querySelector('style')?.textContent).toContain(':nth-child(3) { order: 1; }');

    unmount();
    const { container: remounted } = render(<List reorderable id="runs" />);
    expect(getGrid(remounted).style.gridTemplateColumns).toBe('10rem auto minmax(0, 1fr)');
  });

  it('moves with Alt+Arrow but never into the sticky slot', () => {
    const { container } = render(<List reorderable id="runs" />);
    const status = screen.getByText('Status').closest<HTMLElement>('[draggable]') as HTMLElement;

    fireEvent.keyDown(status, { key: 'ArrowLeft', altKey: true });
    expect(getGrid(container).style.gridTemplateColumns).toBe('10rem minmax(0, 1fr) auto');

    fireEvent.keyDown(status, { key: 'ArrowRight', altKey: true });
    expect(getGrid(container).style.gridTemplateColumns).toBe('10rem auto minmax(0, 1fr)');
  });

  it('ignores a stale stored order whose length no longer matches', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 0]));
    const { container } = render(<List reorderable id="runs" />);
    expect(getGrid(container).style.gridTemplateColumns).toBe('10rem minmax(0, 1fr) auto');
  });
});
