// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataList } from './data-list';
import type { DataListRootProps } from './data-list-root';

const STORAGE_KEY = 'mastra:data-list:column-widths:runs';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const List = (props: Partial<DataListRootProps>) => (
  <DataList columns="100px 200px auto" {...props}>
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

const getHandles = () => screen.queryAllByRole('separator', { name: 'Resize column' });

describe('DataList resizable', () => {
  it('renders no handles without resizable', () => {
    render(<List id="runs" />);
    expect(getHandles()).toHaveLength(0);
  });

  it('renders no handles without an id', () => {
    render(<List resizable />);
    expect(getHandles()).toHaveLength(0);
  });

  it('renders one handle per header cell', () => {
    render(<List resizable id="runs" />);
    expect(getHandles()).toHaveLength(3);
  });

  it('resizes with the keyboard, persists and restores on remount', () => {
    const { container, unmount } = render(<List resizable id="runs" />);
    fireEvent.keyDown(getHandles()[1], { key: 'ArrowRight' });
    expect(getGrid(container).style.gridTemplateColumns).toBe('100px 216px auto');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string)).toEqual({ '1': 216 });

    unmount();
    const remounted = render(<List resizable id="runs" />);
    expect(getGrid(remounted.container).style.gridTemplateColumns).toBe('100px 216px auto');
  });

  it('uses a larger step with Shift', () => {
    const { container } = render(<List resizable id="runs" />);
    fireEvent.keyDown(getHandles()[1], { key: 'ArrowLeft', shiftKey: true });
    expect(getGrid(container).style.gridTemplateColumns).toBe('100px 136px auto');
  });

  it('resizes by dragging and clamps to the minimum width', () => {
    const { container } = render(<List resizable id="runs" />);
    const handle = getHandles()[1];
    fireEvent.pointerDown(handle, { button: 0, clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 340 });
    expect(getGrid(container).style.gridTemplateColumns).toBe('100px 240px auto');
    expect(document.body.style.cursor).toBe('col-resize');

    fireEvent.pointerMove(window, { clientX: -500 });
    expect(getGrid(container).style.gridTemplateColumns).toBe('100px 48px auto');

    fireEvent.pointerUp(window);
    expect(document.body.style.cursor).toBe('');
    fireEvent.pointerMove(window, { clientX: 500 });
    expect(getGrid(container).style.gridTemplateColumns).toBe('100px 48px auto');
  });

  it('resets a column on double click', () => {
    const { container } = render(<List resizable id="runs" />);
    fireEvent.keyDown(getHandles()[1], { key: 'ArrowRight' });
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    fireEvent.doubleClick(getHandles()[1]);
    expect(getGrid(container).style.gridTemplateColumns).toBe('100px 200px auto');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string)).toEqual({});
  });

  it('persists widths by column key', () => {
    const { container } = render(<List resizable id="runs" columnKeys={['name', 'status', 'date']} />);
    fireEvent.keyDown(getHandles()[1], { key: 'ArrowRight' });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string)).toEqual({ status: 216 });
    expect(getGrid(container).style.gridTemplateColumns).toBe('100px 216px auto');
  });

  it('keeps a resized column width after reordering', () => {
    const { container } = render(<List resizable reorderable id="runs" />);
    fireEvent.keyDown(getHandles()[1], { key: 'ArrowRight' });
    expect(getGrid(container).style.gridTemplateColumns).toBe('100px 216px auto');

    const status = screen.getByText('Status').closest<HTMLElement>('[draggable]') as HTMLElement;
    fireEvent.keyDown(status, { key: 'ArrowRight', altKey: true });
    expect(getGrid(container).style.gridTemplateColumns).toBe('100px auto 216px');
  });

  it('measures the visual track of a moved column', () => {
    const { container } = render(<List resizable reorderable id="runs" />);
    const status = screen.getByText('Status').closest<HTMLElement>('[draggable]') as HTMLElement;
    fireEvent.keyDown(status, { key: 'ArrowRight', altKey: true });
    fireEvent.keyDown(getHandles()[1], { key: 'ArrowRight' });
    expect(getGrid(container).style.gridTemplateColumns).toBe('100px auto 216px');
  });

  it('cancels native column drags that start on the handle', () => {
    render(<List resizable reorderable id="runs" />);
    const dataTransfer = { types: [], setData: vi.fn(), getData: () => '', effectAllowed: 'all', dropEffect: 'none' };
    const notCancelled = fireEvent.dragStart(getHandles()[1], { dataTransfer });
    expect(notCancelled).toBe(false);
    expect(dataTransfer.setData).not.toHaveBeenCalled();
  });
});
