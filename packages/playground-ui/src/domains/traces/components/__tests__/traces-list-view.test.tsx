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
