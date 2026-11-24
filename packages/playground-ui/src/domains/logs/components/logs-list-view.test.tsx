// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const observers = new Set<TestIntersectionObserver>();

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds = [];
  private readonly targets: Element[] = [];
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.targets.push(target);
    observers.add(this);
  }
  unobserve() {}
  disconnect() {
    observers.delete(this);
  }
  takeRecords() {
    return [];
  }
  intersect() {
    const entries = this.targets.map(target => ({
      target,
      isIntersecting: true,
      intersectionRatio: 1,
      time: 0,
      boundingClientRect: new DOMRect(),
      intersectionRect: new DOMRect(),
      rootBounds: null,
    }));
    this.callback(entries, this);
  }
}

const scrollOlderEdgeIntoView = () => observers.forEach(observer => observer.intersect());

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  observers.clear();
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

  it('renders plain log lines in the given order under Time, Level and Message, with fields after the message', () => {
    render(<LogsListView density="stream" logs={sandboxLines} logIdMap={idMap} onLogClick={vi.fn()} />);

    const rows = screen.getAllByRole('button');
    expect(rows.map(r => r.textContent)).toEqual([
      expect.stringContaining('Memory usage above 80% of limitused_mb: 842limit_mb: 1024'),
      expect.stringContaining('Process.Start stream ended'),
    ]);
    expect(rows[0]?.textContent).toContain('warn');
    expect(['Time', 'Level', 'Message'].map(label => screen.getByText(label).textContent)).toEqual([
      'Time',
      'Level',
      'Message',
    ]);
  });

  it('tints error lines so they stand out from the rest', () => {
    const lines: LogRecord[] = [
      { timestamp: '2026-11-24T09:35:58.956Z', level: 'error', message: 'Command failed: node server.js' },
      { timestamp: '2026-11-24T09:36:00.000Z', level: 'warn', message: 'Memory usage above 80% of limit' },
    ];
    const ids = new Map(lines.map((log, i) => [log, `tint-${i}`]));
    render(<LogsListView density="stream" logs={lines} logIdMap={ids} onLogClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Command failed/ }).dataset.variant).toBe('error');
    expect(screen.getByRole('button', { name: /Memory usage/ }).dataset.variant).toBe('default');
  });

  it('shows a JSON message as key and value fields', () => {
    const lines: LogRecord[] = [
      {
        timestamp: '2026-11-24T09:35:58.956Z',
        level: 'info',
        message: '{"msg":"request done","status":200,"route":{"path":"/api"}}',
      },
    ];
    render(
      <LogsListView
        density="stream"
        logs={lines}
        logIdMap={new Map(lines.map(log => [log, 'json']))}
        onLogClick={vi.fn()}
      />,
    );

    expect(screen.getByRole('button').textContent).toContain('msg: request donestatus: 200route: {"path":"/api"}');
  });

  it('shows the first three lines of a stack trace and counts the rest', () => {
    const trace = [
      'Error: boom',
      '    at a (a.js:1:1)',
      '    at b (b.js:2:2)',
      '    at c (c.js:3:3)',
      '    at d (d.js:4:4)',
    ];
    const lines: LogRecord[] = [{ timestamp: '2026-11-24T09:35:58.956Z', level: 'error', message: trace.join('\n') }];
    render(
      <LogsListView
        density="stream"
        logs={lines}
        logIdMap={new Map(lines.map(log => [log, 'trace']))}
        onLogClick={vi.fn()}
      />,
    );

    const row = screen.getByRole('button');
    expect(row.textContent).toContain('at b (b.js:2:2)');
    expect(row.textContent).not.toContain('at c (c.js:3:3)');
    expect(row.textContent).toContain('+2 more lines');
  });

  it('shows a four-line message in full instead of hiding one line', () => {
    const message = ['Error: boom', '    at a (a.js:1:1)', '    at b (b.js:2:2)', '    at c (c.js:3:3)'].join('\n');
    const lines: LogRecord[] = [{ timestamp: '2026-11-24T09:35:58.956Z', level: 'error', message }];
    render(
      <LogsListView
        density="stream"
        logs={lines}
        logIdMap={new Map(lines.map(log => [log, 'four']))}
        onLogClick={vi.fn()}
      />,
    );

    const row = screen.getByRole('button');
    expect(row.textContent).toContain('at c (c.js:3:3)');
    expect(row.textContent).not.toContain('more line');
  });

  describe('oldest first, like a terminal', () => {
    it('opens on the newest line and loads older logs only once the top scrolls into view', async () => {
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
      scrollOlderEdgeIntoView();
      expect(onFetchNextPage).not.toHaveBeenCalled();

      visibleCount = undefined;
      rerender(<LogsListView {...props} logs={[...sandboxLines]} />);
      scrollOlderEdgeIntoView();

      expect(onFetchNextPage).toHaveBeenCalledOnce();
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

    it('keeps the loading line in place before and after a page loads, so the lines do not shift', () => {
      const props = {
        density: 'stream',
        order: 'oldest-first',
        logs: sandboxLines,
        logIdMap: idMap,
        onLogClick: vi.fn(),
        hasNextPage: true,
        onFetchNextPage: vi.fn(),
      } as const;
      const { rerender } = render(<LogsListView {...props} />);
      const reserved = screen.getByRole('status');
      expect(reserved.textContent).toBe('');

      rerender(<LogsListView {...props} isFetchingNextPage />);

      expect(screen.getByRole('status')).toBe(reserved);
      expect(reserved.textContent).toBe('Loading older logs');
    });
  });

  describe('newest first, like an audit log', () => {
    it('loads older logs once the bottom scrolls into view, but not while a page is loading', () => {
      const onFetchNextPage = vi.fn();
      const props = {
        density: 'stream',
        logs: sandboxLines,
        logIdMap: idMap,
        onLogClick: vi.fn(),
        hasNextPage: true,
        onFetchNextPage,
      } as const;
      const { rerender } = render(<LogsListView {...props} isFetchingNextPage />);
      scrollOlderEdgeIntoView();
      expect(onFetchNextPage).not.toHaveBeenCalled();
      expect(scrollToIndex).not.toHaveBeenCalled();

      rerender(<LogsListView {...props} />);
      scrollOlderEdgeIntoView();

      expect(onFetchNextPage).toHaveBeenCalledOnce();
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

  it('shows lines that open nothing when no click handler is given', () => {
    render(<LogsListView density="stream" logs={sandboxLines} logIdMap={idMap} />);

    expect(screen.getByText('Process.Start stream ended')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  it('opens the clicked line', () => {
    const onLogClick = vi.fn();
    render(<LogsListView density="stream" logs={sandboxLines} logIdMap={idMap} onLogClick={onLogClick} />);

    fireEvent.click(screen.getByRole('button', { name: /Process.Start stream ended/ }));

    expect(onLogClick).toHaveBeenCalledWith(sandboxLines[1]);
  });
});
