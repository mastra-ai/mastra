// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('LogsListView fit', () => {
  describe('when rendering long log rows', () => {
    it('sizes the grid to its container so rows do not overflow horizontally', () => {
      renderList();

      const grid = Array.from(document.querySelectorAll('div')).find(div => !!div.style.gridTemplateColumns);
      expect(grid?.className).toContain('w-full');
      expect(grid?.className).toContain('max-w-full');
      expect(grid?.className).not.toContain('w-max');
    });
  });
});

describe('LogsListView stream density', () => {
  const sandboxLines: LogRecord[] = [
    {
      timestamp: '2026-11-24T09:29:30.956Z',
      level: 'warn',
      message: 'Memory usage above 80% of limit',
      data: { used_mb: '842', limit_mb: '1024' },
    },
    { timestamp: '2026-11-24T09:31:07.956Z', level: 'info', message: 'Process.Start stream ended' },
  ];
  const idMap = new Map(sandboxLines.map((log, i) => [log, `line-${i}`]));

  it('renders plain log lines oldest first without a column header, with fields after the message', () => {
    render(<LogsListView density="stream" logs={sandboxLines} logIdMap={idMap} onLogClick={vi.fn()} />);

    const rows = screen.getAllByRole('button');
    expect(rows.map(r => r.textContent)).toEqual([
      expect.stringContaining('Memory usage above 80% of limitused_mb: 842limit_mb: 1024'),
      expect.stringContaining('Process.Start stream ended'),
    ]);
    expect(rows[0]?.textContent).toContain('warn');
    expect(screen.queryByText('Message')).toBeNull();
  });

  it('keeps the newest line in view once the logs load', async () => {
    render(<LogsListView density="stream" logs={sandboxLines} logIdMap={idMap} onLogClick={vi.fn()} />);

    await waitFor(() => expect(scrollToIndex).toHaveBeenCalledWith(1, { align: 'end' }));
  });

  it('loads older logs from a button above the lines', () => {
    const onFetchNextPage = vi.fn();
    render(
      <LogsListView
        density="stream"
        logs={sandboxLines}
        logIdMap={idMap}
        onLogClick={vi.fn()}
        hasNextPage
        onFetchNextPage={onFetchNextPage}
      />,
    );

    const loadOlder = screen.getByRole('button', { name: 'Load older logs' });
    const firstLine = screen.getByRole('button', { name: /Memory usage above 80% of limit/ });
    expect(loadOlder.compareDocumentPosition(firstLine)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.click(loadOlder);
    expect(onFetchNextPage).toHaveBeenCalledOnce();
  });

  it('opens the clicked line', () => {
    const onLogClick = vi.fn();
    render(<LogsListView density="stream" logs={sandboxLines} logIdMap={idMap} onLogClick={onLogClick} />);

    fireEvent.click(screen.getByRole('button', { name: /Process.Start stream ended/ }));

    expect(onLogClick).toHaveBeenCalledWith(sandboxLines[1]);
  });
});
