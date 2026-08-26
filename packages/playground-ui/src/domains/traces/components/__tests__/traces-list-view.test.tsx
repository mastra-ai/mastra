// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, assert, beforeAll, describe, expect, it, vi } from 'vitest';

import { TracesListView } from '../traces-list-view';
import type { TracesListViewTrace } from '../traces-list-view';

// jsdom implements neither ResizeObserver nor element layout; without both the
// virtualizer sees a zero-height scroll container and renders no rows. The stub
// reports a fixed viewport size for every observed element so rows materialize.
beforeAll(() => {
  class ResizeObserverStub {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [
          {
            target,
            contentRect: new DOMRect(0, 0, 800, 600),
            borderBoxSize: [{ inlineSize: 800, blockSize: 600 }],
            contentBoxSize: [{ inlineSize: 800, blockSize: 600 }],
            devicePixelContentBoxSize: [{ inlineSize: 800, blockSize: 600 }],
          },
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 600));
});

const timestamp = new Date('2026-06-10T00:00:00.000Z');

function makeTrace(
  overrides: Partial<TracesListViewTrace> & Pick<TracesListViewTrace, 'traceId'>,
): TracesListViewTrace {
  return {
    name: `run ${overrides.traceId}`,
    createdAt: timestamp,
    startedAt: timestamp,
    ...overrides,
  };
}

afterEach(() => cleanup());

describe('TracesListView columns', () => {
  describe('when no column preferences are provided', () => {
    it('keeps the existing default headers and grid', () => {
      const { container } = render(<TracesListView traces={[]} onTraceClick={vi.fn()} />);

      expect(screen.getByText('Input')).toBeTruthy();
      expect(screen.getByText('Entity')).toBeTruthy();
      expect(screen.queryByText('Duration')).toBeNull();

      const grid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      assert(grid);
      expect(grid.style.gridTemplateColumns).toBe('6rem 9rem 14rem minmax(8rem,1fr) 14rem 6rem');
    });
  });

  describe('when optional and metadata columns are selected', () => {
    it('renders every selected header in the matching grid', () => {
      const { container } = render(
        <TracesListView
          traces={[]}
          columnPreferences={{
            visibleColumns: ['duration', 'inputTokens', 'outputTokens', 'estimatedCost'],
            metadataKeys: ['tenantId'],
          }}
          onTraceClick={vi.fn()}
        />,
      );

      expect(screen.queryByText('Input')).toBeNull();
      expect(screen.queryByText('Entity')).toBeNull();
      expect(screen.getByText('Duration')).toBeTruthy();
      expect(screen.getByText('Input tokens')).toBeTruthy();
      expect(screen.getByText('Output tokens')).toBeTruthy();
      expect(screen.getByText('Est. cost')).toBeTruthy();
      expect(screen.getByText('tenantId')).toBeTruthy();

      const grid = container.querySelector<HTMLElement>('[style*="grid-template-columns"]');
      assert(grid);
      expect(grid.style.gridTemplateColumns).toBe(
        '6rem 9rem minmax(14rem,1fr) 6rem 7rem 8rem 8rem 8rem minmax(8rem,14rem)',
      );
    });
  });
});

describe('TracesListView — status column', () => {
  it('renders the computed status carried by lightweight rows', () => {
    render(
      <TracesListView
        traces={[
          makeTrace({ traceId: 'trace-failed', status: 'error', endedAt: timestamp }),
          makeTrace({ traceId: 'trace-succeeded', status: 'success', endedAt: timestamp }),
          makeTrace({ traceId: 'trace-running', status: 'running' }),
        ]}
        onTraceClick={vi.fn()}
      />,
    );

    const statuses = screen
      .getAllByRole('button')
      .map(row => row.lastElementChild?.textContent)
      .filter(text => text !== undefined);
    expect(statuses).toEqual(['ERR', 'OK', 'RUN']);
  });

  it('renders a dash when a row carries no status', () => {
    render(<TracesListView traces={[makeTrace({ traceId: 'trace-unknown' })]} onTraceClick={vi.fn()} />);

    const statuses = screen.getAllByRole('button').map(row => row.lastElementChild?.textContent);
    expect(statuses).toEqual(['-']);
  });
});

describe('TracesListView — entity column', () => {
  it('names the entity from entityName, falling back to entityId', () => {
    render(
      <TracesListView
        traces={[
          makeTrace({ traceId: 'trace-named', entityType: 'agent', entityName: 'weatherAgent' }),
          makeTrace({ traceId: 'trace-unnamed', entityType: 'agent', entityId: 'agent-42' }),
        ]}
        onTraceClick={vi.fn()}
      />,
    );

    expect(screen.getByText('weatherAgent')).not.toBeNull();
    expect(screen.getByText('agent-42')).not.toBeNull();
  });
});

describe('TracesListView — rows', () => {
  it('reports the trace behind the row that was clicked', () => {
    const onTraceClick = vi.fn();
    const first = makeTrace({ traceId: 'trace-1' });
    render(<TracesListView traces={[first, makeTrace({ traceId: 'trace-2' })]} onTraceClick={onTraceClick} />);

    screen.getAllByRole('button')[1]?.click();

    expect(onTraceClick).toHaveBeenCalledWith(expect.objectContaining({ traceId: 'trace-2' }));
  });

  it('features the selected trace and leaves the others plain', () => {
    render(
      <TracesListView
        traces={[makeTrace({ traceId: 'trace-1' }), makeTrace({ traceId: 'trace-2' })]}
        featuredTraceId="trace-2"
        onTraceClick={vi.fn()}
      />,
    );

    const rows = screen.getAllByRole('button');
    expect(rows[0]?.classList.contains('bg-surface4!')).toBe(false);
    expect(rows[1]?.classList.contains('bg-surface4!')).toBe(true);
  });

  it('needs the span to match too when branch rows share a trace', () => {
    render(
      <TracesListView
        traces={[
          makeTrace({ traceId: 'trace-1', spanId: 'span-a', name: 'branch a' }),
          makeTrace({ traceId: 'trace-1', spanId: 'span-b', name: 'branch b' }),
        ]}
        featuredTraceId="trace-1"
        featuredSpanId="span-b"
        onTraceClick={vi.fn()}
      />,
    );

    const rows = screen.getAllByRole('button');
    expect(rows[0]?.classList.contains('bg-surface4!')).toBe(false);
    expect(rows[1]?.classList.contains('bg-surface4!')).toBe(true);
  });

  it('tints only the rows that just arrived', () => {
    render(
      <TracesListView
        traces={[makeTrace({ traceId: 'trace-1' }), makeTrace({ traceId: 'trace-2' })]}
        recentlyAddedKeys={new Set(['trace-2:'])}
        onTraceClick={vi.fn()}
      />,
    );

    const rows = screen.getAllByRole('button');
    expect(rows[0]?.className).not.toContain('animate-row-highlight');
    expect(rows[1]?.className).toContain('animate-row-highlight');
  });

  it('tints nothing when no rows are marked as new', () => {
    render(<TracesListView traces={[makeTrace({ traceId: 'trace-1' })]} onTraceClick={vi.fn()} />);

    expect(screen.getAllByRole('button')[0]?.className).not.toContain('animate-row-highlight');
  });

  it('stamps a row by when it started, not when the record was created', () => {
    render(
      <TracesListView
        traces={[
          makeTrace({
            traceId: 'trace-1',
            startedAt: new Date('2026-06-11T08:30:00.000Z'),
            createdAt: new Date('2026-06-12T19:45:00.000Z'),
          }),
        ]}
        onTraceClick={vi.fn()}
      />,
    );

    const row = screen.getAllByRole('button')[0];
    const startedLabel = new Date('2026-06-11T08:30:00.000Z').getDate().toString();
    expect(row?.textContent).toContain(startedLabel);
    expect(row?.textContent).not.toContain(new Date('2026-06-12T19:45:00.000Z').getDate().toString());
  });

  it('falls back to the created time when the trace never started', () => {
    render(
      <TracesListView
        traces={[
          makeTrace({
            traceId: 'trace-1',
            startedAt: null,
            createdAt: new Date('2026-06-11T08:30:00.000Z'),
          }),
        ]}
        onTraceClick={vi.fn()}
      />,
    );

    // The row is stamped from createdAt rather than left blank.
    const row = screen.getAllByRole('button')[0];
    expect(row?.textContent).toContain(new Date('2026-06-11T08:30:00.000Z').getDate().toString());
  });

  it('prefers the preview the server rendered over one derived from the raw input', () => {
    render(
      <TracesListView
        traces={[makeTrace({ traceId: 'trace-1', inputPreview: 'server preview', input: { raw: 'local input' } })]}
        onTraceClick={vi.fn()}
      />,
    );

    expect(screen.getByText('server preview')).toBeTruthy();
    expect(screen.queryByText(/local input/)).toBeNull();
  });

  it('derives a preview itself when the row carries none', () => {
    render(
      <TracesListView
        traces={[makeTrace({ traceId: 'trace-1', input: { prompt: 'what is the weather' } })]}
        onTraceClick={vi.fn()}
      />,
    );

    expect(screen.getByText(/what is the weather/)).toBeTruthy();
  });

  it('explains the level icon only where rows mix traces and subtraces', () => {
    const trigger = (root: HTMLElement) => root.querySelector('[data-base-ui-tooltip-trigger]');

    const flat = render(<TracesListView traces={[makeTrace({ traceId: 'trace-1' })]} onTraceClick={vi.fn()} />);
    expect(trigger(flat.container)).toBeNull();

    cleanup();

    const branches = render(
      <TracesListView traces={[makeTrace({ traceId: 'trace-1' })]} isBranchesMode onTraceClick={vi.fn()} />,
    );
    expect(trigger(branches.container)).not.toBeNull();
  });
});

describe('TracesListView — empty and loading', () => {
  it('shows a skeleton while the first page is loading', () => {
    render(<TracesListView traces={[]} isLoading onTraceClick={vi.fn()} />);

    // The skeleton stands in for the list — no empty-state copy yet.
    expect(screen.queryByText('No traces found yet')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('distinguishes an empty result from an empty filter result', () => {
    const unfiltered = render(<TracesListView traces={[]} onTraceClick={vi.fn()} />);
    expect(screen.getByText('No traces found yet')).toBeTruthy();
    expect(unfiltered.container).toBeTruthy();

    cleanup();

    render(<TracesListView traces={[]} filtersApplied onTraceClick={vi.fn()} />);
    expect(screen.getByText('No traces found for applied filters')).toBeTruthy();
  });
});

describe('TracesListView — usage cells', () => {
  const usageColumns = {
    visibleColumns: ['inputTokens', 'outputTokens', 'estimatedCost'] as const,
    metadataKeys: [] as string[],
  };

  it('shows the totals for the trace they belong to', () => {
    render(
      <TracesListView
        traces={[makeTrace({ traceId: 'trace-1' })]}
        columnPreferences={usageColumns}
        usageByTraceId={
          new Map([['trace-1', { inputTokens: 12_400, outputTokens: 800, estimatedCost: 0.0123, costUnit: 'eur' }]])
        }
        onTraceClick={vi.fn()}
      />,
    );

    expect(screen.getByText('12.4K')).toBeTruthy();
    expect(screen.getByText('800')).toBeTruthy();
    expect(screen.getByText('0.0123 eur')).toBeTruthy();
  });

  it('leaves the usage cells blank for a trace with no totals', () => {
    render(
      <TracesListView
        traces={[makeTrace({ traceId: 'trace-1' })]}
        columnPreferences={usageColumns}
        usageByTraceId={new Map()}
        onTraceClick={vi.fn()}
      />,
    );

    expect(screen.queryByText('12.4K')).toBeNull();
    expect(screen.getAllByRole('button')[0]?.textContent).not.toContain('NaN');
  });
});

describe('TracesListView — metadata cells', () => {
  it('shows the value under each selected metadata key', () => {
    render(
      <TracesListView
        traces={[makeTrace({ traceId: 'trace-1', metadata: { tenantId: 'acme', region: 'eu-west-1' } })]}
        columnPreferences={{ visibleColumns: [], metadataKeys: ['tenantId', 'region'] }}
        onTraceClick={vi.fn()}
      />,
    );

    expect(screen.getByText('acme')).toBeTruthy();
    expect(screen.getByText('eu-west-1')).toBeTruthy();
  });

  it('leaves the cell alone when the trace carries no such key', () => {
    render(
      <TracesListView
        traces={[makeTrace({ traceId: 'trace-1', metadata: { tenantId: 'acme' } })]}
        columnPreferences={{ visibleColumns: [], metadataKeys: ['tenantId', 'missing'] }}
        onTraceClick={vi.fn()}
      />,
    );

    expect(screen.getByText('acme')).toBeTruthy();
    expect(screen.getAllByRole('button')[0]?.textContent).not.toContain('undefined');
  });
});

describe('TracesListView — scrolling back to the top', () => {
  it('re-reads the scroll position once a fresh query resolves', () => {
    const dispatchEvent = vi.spyOn(HTMLElement.prototype, 'dispatchEvent');
    const { rerender } = render(<TracesListView traces={[]} isLoading onTraceClick={vi.fn()} />);
    dispatchEvent.mockClear();

    rerender(<TracesListView traces={[makeTrace({ traceId: 'trace-1' })]} onTraceClick={vi.fn()} />);

    // The list swapped its scroll container, so the virtualizer has to be told
    // to read the new element's scrollTop rather than keep the old offset.
    expect(dispatchEvent.mock.calls.some(([event]) => event.type === 'scroll')).toBe(true);
    dispatchEvent.mockRestore();
  });

  it('leaves the scroll position alone while paginating', () => {
    const { rerender } = render(<TracesListView traces={[makeTrace({ traceId: 'trace-1' })]} onTraceClick={vi.fn()} />);
    const dispatchEvent = vi.spyOn(HTMLElement.prototype, 'dispatchEvent');

    rerender(
      <TracesListView
        traces={[makeTrace({ traceId: 'trace-1' }), makeTrace({ traceId: 'trace-2' })]}
        isFetchingNextPage
        onTraceClick={vi.fn()}
      />,
    );

    expect(dispatchEvent.mock.calls.some(([event]) => event.type === 'scroll')).toBe(false);
    dispatchEvent.mockRestore();
  });

  it('leaves the scroll position alone when a query starts', () => {
    const { rerender } = render(<TracesListView traces={[makeTrace({ traceId: 'trace-1' })]} onTraceClick={vi.fn()} />);
    const dispatchEvent = vi.spyOn(HTMLElement.prototype, 'dispatchEvent');

    rerender(<TracesListView traces={[]} isLoading onTraceClick={vi.fn()} />);

    expect(dispatchEvent.mock.calls.some(([event]) => event.type === 'scroll')).toBe(false);
    dispatchEvent.mockRestore();
  });
});

describe('TracesListView — the virtual window', () => {
  const spacersIn = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>('.col-span-full[style*="height"]')).map(
      spacer => spacer.style.height,
    );

  it('reserves no room above or below a list that fits', () => {
    const { container } = render(
      <TracesListView
        traces={[makeTrace({ traceId: 'trace-1' }), makeTrace({ traceId: 'trace-2' })]}
        onTraceClick={vi.fn()}
      />,
    );

    // Every row is on screen, so nothing is scrolled past in either direction.
    expect(spacersIn(container)).toEqual([]);
  });

  it('reserves room below for the rows it did not render', () => {
    const traces = Array.from({ length: 400 }, (_, index) => makeTrace({ traceId: `trace-${index}` }));
    const { container } = render(<TracesListView traces={traces} onTraceClick={vi.fn()} />);

    expect(screen.getAllByRole('button').length).toBeLessThan(traces.length);

    // The window opens at the top: nothing is scrolled past above it, and the
    // rows below it still hold their place in the scroll height.
    const spacers = spacersIn(container);
    expect(spacers).toHaveLength(1);
    expect(Number.parseFloat(spacers[0] ?? '0')).toBeGreaterThan(0);
  });
});

describe('TracesListView — the duration column', () => {
  it('shows how long each trace took', () => {
    render(
      <TracesListView
        traces={[
          makeTrace({
            traceId: 'trace-1',
            startedAt: new Date('2026-06-10T00:00:00.000Z'),
            endedAt: new Date('2026-06-10T00:00:46.301Z'),
          }),
        ]}
        columnPreferences={{ visibleColumns: ['duration'], metadataKeys: [] }}
        onTraceClick={vi.fn()}
      />,
    );

    expect(screen.getByText('46.3s')).toBeTruthy();
  });

  it('leaves the duration out when the column is not selected', () => {
    render(
      <TracesListView
        traces={[
          makeTrace({
            traceId: 'trace-1',
            startedAt: new Date('2026-06-10T00:00:00.000Z'),
            endedAt: new Date('2026-06-10T00:00:46.301Z'),
          }),
        ]}
        columnPreferences={{ visibleColumns: [], metadataKeys: [] }}
        onTraceClick={vi.fn()}
      />,
    );

    expect(screen.queryByText('46.3s')).toBeNull();
  });
});

describe('TracesListView — featuring by trace alone', () => {
  it('features a branch row by its trace when no span was named', () => {
    render(
      <TracesListView
        traces={[
          makeTrace({ traceId: 'trace-1', spanId: 'span-a', name: 'branch a' }),
          makeTrace({ traceId: 'trace-2', spanId: 'span-b', name: 'branch b' }),
        ]}
        featuredTraceId="trace-1"
        onTraceClick={vi.fn()}
      />,
    );

    const rows = screen.getAllByRole('button');
    expect(rows[0]?.classList.contains('bg-surface4!')).toBe(true);
    expect(rows[1]?.classList.contains('bg-surface4!')).toBe(false);
  });
});
