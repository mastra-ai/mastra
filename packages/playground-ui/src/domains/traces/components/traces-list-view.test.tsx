// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TracesListView } from './traces-list-view';
import type { TracesListViewTrace } from './traces-list-view';

const scrollToIndex = vi.fn();

// jsdom has no layout, so the real virtualizer would render zero rows.
// Render every row instead and spy on scrollToIndex.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 36, end: (index + 1) * 36 })),
    getTotalSize: () => count * 36,
    measureElement: () => {},
    scrollToIndex,
  }),
}));

const makeTrace = (i: number): TracesListViewTrace => ({
  traceId: `trace-${i}`,
  name: `trace ${i}`,
  createdAt: new Date('2026-08-25T10:00:00Z'),
});

const renderList = () => {
  const traces = [makeTrace(0), makeTrace(1), makeTrace(2)];
  render(<TracesListView traces={traces} onTraceClick={vi.fn()} />);
  return traces;
};

const row = (i: number) => screen.getByRole('button', { name: new RegExp(`trace ${i}`) });

afterEach(() => {
  cleanup();
  scrollToIndex.mockClear();
});

describe('TracesListView keyboard navigation', () => {
  it('uses roving tabindex so only one row is tabbable', () => {
    renderList();

    expect(row(0).tabIndex).toBe(0);
    expect(row(1).tabIndex).toBe(-1);
    expect(row(2).tabIndex).toBe(-1);
  });

  it('moves focus with arrow keys and scrolls the virtualizer to the target index', () => {
    renderList();
    row(0).focus();

    fireEvent.keyDown(row(0), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row(1));
    expect(scrollToIndex).toHaveBeenCalledWith(1);

    fireEvent.keyDown(row(1), { key: 'End' });
    expect(document.activeElement).toBe(row(2));
    expect(scrollToIndex).toHaveBeenCalledWith(2);

    fireEvent.keyDown(row(2), { key: 'Home' });
    expect(document.activeElement).toBe(row(0));
    expect(scrollToIndex).toHaveBeenCalledWith(0);
  });
});
