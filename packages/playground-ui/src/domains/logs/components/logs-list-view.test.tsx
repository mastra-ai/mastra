// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogRecord } from '../types';
import { LogsListView } from './logs-list-view';

const scrollToIndex = vi.fn();
let visibleCount: number | undefined;

// jsdom has no layout, so the real virtualizer would render zero rows.
// Render every row instead and spy on scrollToIndex.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: Math.min(count, visibleCount ?? count) }, (_, index) => ({
        index,
        key: index,
        start: index * 36,
        end: (index + 1) * 36,
      })),
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
  visibleCount = undefined;
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

  it('renders plain log lines in the given order without a column header, with fields after the message', () => {
    render(<LogsListView density="stream" logs={sandboxLines} logIdMap={idMap} onLogClick={vi.fn()} />);

    const rows = screen.getAllByRole('button');
    expect(rows.map(r => r.textContent)).toEqual([
      expect.stringContaining('Memory usage above 80% of limitused_mb: 842limit_mb: 1024'),
      expect.stringContaining('Process.Start stream ended'),
    ]);
    expect(rows[0]?.textContent).toContain('warn');
    expect(screen.queryByText('Message')).toBeNull();
  });

  describe('oldest first, like a terminal', () => {
    it('opens on the newest line before it loads older logs at the top', async () => {
      const onFetchNextPage = vi.fn();
      const props = {
        density: 'stream',
        order: 'oldest-first',
        logs: sandboxLines,
        logIdMap: idMap,
        onLogClick: vi.fn(),
        hasNextPage: true,
        onFetchNextPage,
      } as const;
      visibleCount = 1;
      const { rerender } = render(<LogsListView {...props} />);

      await waitFor(() => expect(scrollToIndex).toHaveBeenCalledWith(1, { align: 'end' }));
      expect(onFetchNextPage).not.toHaveBeenCalled();

      visibleCount = undefined;
      rerender(<LogsListView {...props} logs={[...sandboxLines]} />);

      await waitFor(() => expect(onFetchNextPage).toHaveBeenCalledOnce());
    });

    it('shows that older logs are loading above the lines', () => {
      render(
        <LogsListView
          density="stream"
          order="oldest-first"
          logs={sandboxLines}
          logIdMap={idMap}
          onLogClick={vi.fn()}
          hasNextPage
          isFetchingNextPage
          onFetchNextPage={vi.fn()}
        />,
      );

      const status = screen.getByRole('status');
      expect(status.textContent).toBe('Loading older logs');
      const firstLine = screen.getByRole('button', { name: /Memory usage above 80% of limit/ });
      expect(status.compareDocumentPosition(firstLine)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  describe('newest first, like an audit log', () => {
    it('loads older logs only once the bottom line is in view', async () => {
      const onFetchNextPage = vi.fn();
      const props = {
        density: 'stream',
        logs: sandboxLines,
        logIdMap: idMap,
        onLogClick: vi.fn(),
        hasNextPage: true,
        onFetchNextPage,
      } as const;
      visibleCount = 1;
      const { rerender } = render(<LogsListView {...props} />);
      expect(onFetchNextPage).not.toHaveBeenCalled();
      expect(scrollToIndex).not.toHaveBeenCalled();

      visibleCount = undefined;
      rerender(<LogsListView {...props} logs={[...sandboxLines]} />);

      await waitFor(() => expect(onFetchNextPage).toHaveBeenCalledOnce());
    });

    it('shows that older logs are loading below the lines', () => {
      render(
        <LogsListView
          density="stream"
          logs={sandboxLines}
          logIdMap={idMap}
          onLogClick={vi.fn()}
          hasNextPage
          isFetchingNextPage
          onFetchNextPage={vi.fn()}
        />,
      );

      const lastLine = screen.getByRole('button', { name: /Process.Start stream ended/ });
      expect(lastLine.compareDocumentPosition(screen.getByRole('status'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  it('opens the clicked line', () => {
    const onLogClick = vi.fn();
    render(<LogsListView density="stream" logs={sandboxLines} logIdMap={idMap} onLogClick={onLogClick} />);

    fireEvent.click(screen.getByRole('button', { name: /Process.Start stream ended/ }));

    expect(onLogClick).toHaveBeenCalledWith(sandboxLines[1]);
  });
});
