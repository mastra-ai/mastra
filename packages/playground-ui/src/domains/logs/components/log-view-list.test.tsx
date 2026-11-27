// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogRecord } from '../types';
import { LogViewList } from './log-view-list';
import type { LogViewListHandle } from './log-view-list';

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
  render(<LogViewList logs={logs} logIdMap={logIdMap} onLogClick={vi.fn()} />);
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

const scrollPageEdgeIntoView = () => observers.forEach(observer => observer.intersect());

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  observers.clear();
});

describe('LogViewList', () => {
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
    render(<LogViewList logs={sandboxLines} logIdMap={idMap} onLogClick={vi.fn()} />);

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

  it('shows a JSON message as key and value fields', () => {
    const lines: LogRecord[] = [
      {
        timestamp: '2026-11-24T09:35:58.956Z',
        level: 'info',
        message: '{"msg":"request done","status":200,"route":{"path":"/api"}}',
      },
    ];
    render(<LogViewList logs={lines} logIdMap={new Map(lines.map(log => [log, 'json']))} onLogClick={vi.fn()} />);

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
    render(<LogViewList logs={lines} logIdMap={new Map(lines.map(log => [log, 'trace']))} onLogClick={vi.fn()} />);

    const row = screen.getByRole('button');
    expect(row.textContent).toContain('at b (b.js:2:2)');
    expect(row.textContent).not.toContain('at c (c.js:3:3)');
    expect(row.textContent).toContain('+2 more lines');
  });

  it('shows a four-line message in full instead of hiding one line', () => {
    const message = ['Error: boom', '    at a (a.js:1:1)', '    at b (b.js:2:2)', '    at c (c.js:3:3)'].join('\n');
    const lines: LogRecord[] = [{ timestamp: '2026-11-24T09:35:58.956Z', level: 'error', message }];
    render(<LogViewList logs={lines} logIdMap={new Map(lines.map(log => [log, 'four']))} onLogClick={vi.fn()} />);

    const row = screen.getByRole('button');
    expect(row.textContent).toContain('at c (c.js:3:3)');
    expect(row.textContent).not.toContain('more line');
  });

  describe('oldest first, like a terminal', () => {
    const props = {
      order: 'oldest-first',
      logs: sandboxLines,
      logIdMap: idMap,
      onLogClick: vi.fn(),
      hasNextPage: true,
    } as const;

    it('loads older logs once the top scrolls into view', () => {
      const onFetchNextPage = vi.fn();
      render(<LogViewList {...props} onFetchNextPage={onFetchNextPage} />);
      expect(onFetchNextPage).not.toHaveBeenCalled();

      scrollPageEdgeIntoView();

      expect(onFetchNextPage).toHaveBeenCalledOnce();
    });

    it('keeps loading older pages when filters leave the loaded page empty', () => {
      const onFetchNextPage = vi.fn();
      render(<LogViewList {...props} logs={[]} onFetchNextPage={onFetchNextPage} />);

      scrollPageEdgeIntoView();

      expect(onFetchNextPage).toHaveBeenCalledOnce();
    });

    it('shows that older logs are loading above the lines', () => {
      render(
        <LogViewList
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
        order: 'oldest-first',
        logs: sandboxLines,
        logIdMap: idMap,
        onLogClick: vi.fn(),
        hasNextPage: true,
        onFetchNextPage: vi.fn(),
      } as const;
      const { rerender } = render(<LogViewList {...props} />);
      const reserved = screen.getByRole('status');
      expect(reserved.textContent).toBe('');

      rerender(<LogViewList {...props} isFetchingNextPage />);

      expect(screen.getByRole('status')).toBe(reserved);
      expect(reserved.textContent).toBe('Loading older logs');
    });
  });

  describe('oldest first, paging forward to newer logs', () => {
    const props = {
      order: 'oldest-first',
      nextPage: 'newer',
      logs: sandboxLines,
      logIdMap: idMap,
      onLogClick: vi.fn(),
      hasNextPage: true,
    } as const;

    it('loads newer logs once the bottom scrolls into view', () => {
      const onFetchNextPage = vi.fn();
      render(<LogViewList {...props} onFetchNextPage={onFetchNextPage} />);

      scrollPageEdgeIntoView();

      expect(onFetchNextPage).toHaveBeenCalledOnce();
    });

    it('shows that newer logs are loading below the lines', () => {
      render(<LogViewList {...props} isFetchingNextPage onFetchNextPage={vi.fn()} />);

      const status = screen.getByRole('status');
      expect(status.textContent).toBe('Loading newer logs');
      const lastLine = screen.getByRole('button', { name: /Process.Start stream ended/ });
      expect(status.compareDocumentPosition(lastLine)).toBe(Node.DOCUMENT_POSITION_PRECEDING);
    });
  });

  describe('newest first, like an audit log', () => {
    it('loads older logs once the bottom scrolls into view, but not while a page is loading', () => {
      const onFetchNextPage = vi.fn();
      const props = {
        logs: sandboxLines,
        logIdMap: idMap,
        onLogClick: vi.fn(),
        hasNextPage: true,
        onFetchNextPage,
      } as const;
      const { rerender } = render(<LogViewList {...props} isFetchingNextPage />);
      scrollPageEdgeIntoView();
      expect(onFetchNextPage).not.toHaveBeenCalled();
      expect(scrollToIndex).not.toHaveBeenCalled();

      rerender(<LogViewList {...props} />);
      scrollPageEdgeIntoView();

      expect(onFetchNextPage).toHaveBeenCalledOnce();
    });

    it('shows that older logs are loading below the lines', () => {
      render(
        <LogViewList
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
    render(<LogViewList logs={sandboxLines} logIdMap={idMap} />);

    expect(screen.getByText('Process.Start stream ended')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toEqual([]);
  });

  it('shows the whole stack trace on lines that open nothing, since no panel can reveal it', () => {
    const message = [
      'Error: boom',
      '    at a (a.js:1:1)',
      '    at b (b.js:2:2)',
      '    at c (c.js:3:3)',
      '    at d (d.js:4:4)',
    ].join('\n');
    const lines: LogRecord[] = [{ timestamp: '2026-11-24T09:35:58.956Z', level: 'error', message }];
    render(<LogViewList logs={lines} logIdMap={new Map(lines.map(log => [log, 'trace']))} />);

    expect(screen.getByText(/at d \(d\.js:4:4\)/)).toBeTruthy();
    expect(screen.queryByText(/more lines/)).toBeNull();
  });

  it('scrolls a line into view by its id, so a page can jump to an error', () => {
    const handle: { current: LogViewListHandle | null } = { current: null };
    render(<LogViewList ref={handle} logs={sandboxLines} logIdMap={idMap} />);

    handle.current?.scrollToLog('line-1');

    expect(scrollToIndex).toHaveBeenCalledWith(1, { align: 'center' });
  });

  it('shows lines that have no time or level', () => {
    const lines = [{ message: 'npm warn deprecated inflight@1.0.6' }];
    render(<LogViewList logs={lines} logIdMap={new Map(lines.map(log => [log, 'plain']))} />);

    expect(screen.getByText('npm warn deprecated inflight@1.0.6')).toBeTruthy();
  });

  it('opens the clicked line', () => {
    const onLogClick = vi.fn();
    render(<LogViewList logs={sandboxLines} logIdMap={idMap} onLogClick={onLogClick} />);

    fireEvent.click(screen.getByRole('button', { name: /Process.Start stream ended/ }));

    expect(onLogClick).toHaveBeenCalledWith(sandboxLines[1]);
  });
});
