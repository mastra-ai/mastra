// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogRecord } from '../types';
import { LogsListView } from './logs-list-view';

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

const makeLog = (i: number): LogRecord => ({
  logId: `log-${i}`,
  timestamp: new Date('2026-08-25T10:00:00Z'),
  level: 'info',
  message: `log message ${i}`,
});

const renderList = () => {
  const logs = [makeLog(0), makeLog(1), makeLog(2)];
  const logIdMap = new Map(logs.map(log => [log, log.logId ?? '']));
  render(<LogsListView logs={logs} logIdMap={logIdMap} onLogClick={vi.fn()} />);
};

const row = (i: number) => screen.getByRole('button', { name: new RegExp(`log message ${i}`) });

afterEach(() => {
  cleanup();
  scrollToIndex.mockClear();
});

describe('LogsListView keyboard navigation', () => {
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
  });
});
