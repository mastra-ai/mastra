// @vitest-environment jsdom
import '@/test/inert-resize-observer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render as renderUI, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TraceDataPanelView } from '../trace-data-panel-view';
import type { TraceDataPanelViewProps } from '../trace-data-panel-view';
import { rootSpanFixture } from './fixtures/trace-data-panel-view';

let queryClient: QueryClient;
beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  localStorage.clear();
});

const render = (ui: ReactNode) =>
  renderUI(ui, {
    wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  });

const withEntityType = (entityType: string) => rootSpanFixture.map(span => ({ ...span, entityType }));

const props = (entityType: string): TraceDataPanelViewProps => ({
  traceId: 'trace-1',
  spans: withEntityType(entityType),
  onClose: vi.fn(),
  placement: 'traces-list',
  messagesPanelSlot: <div>messages</div>,
});

const storageKey = (entityType: string) => `mastra:trace-panel-widths:${entityType}`;

const sidePanelFlexGrow = () =>
  (document.body.querySelector('[data-panel][id="trace-side"]') as HTMLElement | null)?.style.flexGrow;

// jsdom lays nothing out: give the panel group a real width, split across its panels, and report it
// through ResizeObserver — pixel default sizes only resolve once the group has been measured.
const GROUP_WIDTH = 1200;
class MeasuringResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe(target: Element) {
    queueMicrotask(() =>
      this.callback(
        [{ target, borderBoxSize: [{ inlineSize: GROUP_WIDTH, blockSize: 800 }] } as unknown as ResizeObserverEntry],
        this,
      ),
    );
  }
  unobserve() {}
  disconnect() {}
}
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MeasuringResizeObserver);
  // Panels split the group evenly and separators are zero-width, laid out in DOM order, so the
  // library can pair each separator with the panels on either side of it.
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute('data-separator')) return 0;
    if (!this.hasAttribute('data-panel')) return GROUP_WIDTH;
    return GROUP_WIDTH / (this.parentElement?.querySelectorAll(':scope > [data-panel]').length ?? 1);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
    let left = 0;
    for (let sibling = this.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      left += (sibling as HTMLElement).offsetWidth;
    }
    return left;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const isColumn = this.hasAttribute('data-panel') || this.hasAttribute('data-separator');
    return new DOMRect(isColumn ? this.offsetLeft : 0, 0, this.offsetWidth, 800);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const sideWidthPercent = (px: number) => (px / GROUP_WIDTH) * 100;
const expectSideWidth = (px: number) =>
  waitFor(() => expect(Number(sidePanelFlexGrow())).toBeCloseTo(sideWidthPercent(px)));

describe('TraceDataPanelView — default side column width', () => {
  it('starts the side column at 480px for agent traces', async () => {
    render(<TraceDataPanelView {...props('agent')} />);

    await expectSideWidth(480);
  });

  it('starts the side column at 320px for non-agent traces', async () => {
    render(<TraceDataPanelView {...props('workflow_run')} />);

    await expectSideWidth(320);
  });
});

describe('TraceDataPanelView — persisted widths', () => {
  it('restores the side column width, in pixels, stored for the trace entity type', async () => {
    localStorage.setItem(storageKey('agent'), JSON.stringify({ side: 700 }));

    render(<TraceDataPanelView {...props('agent')} />);

    await expectSideWidth(700);
  });

  it('does not apply a width stored for another entity type', async () => {
    localStorage.setItem(storageKey('agent'), JSON.stringify({ side: 700 }));

    render(<TraceDataPanelView {...props('scorer')} />);

    await expectSideWidth(320);
  });

  it('falls back to the default width when the stored value is corrupted', async () => {
    localStorage.setItem(storageKey('agent'), '{not json');

    render(<TraceDataPanelView {...props('agent')} />);

    await expectSideWidth(480);
  });

  it('falls back to the default width when storage is unavailable', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    render(<TraceDataPanelView {...props('agent')} />);

    await expectSideWidth(480);
    getItem.mockRestore();
  });

  it('lays the columns out at their stored widths while the trace is still loading', async () => {
    localStorage.setItem(storageKey('agent'), JSON.stringify({ side: 700 }));
    const loading = { ...props('agent'), spans: undefined, isLoading: true, entityType: 'agent' };

    const { rerender } = render(<TraceDataPanelView {...loading} />);
    await expectSideWidth(700);
    const sidePanel = document.body.querySelector('[data-panel][id="trace-side"]');

    rerender(<TraceDataPanelView {...props('agent')} />);

    // Same columns once the spans land: no remount, so nothing shifts.
    await expectSideWidth(700);
    expect(document.body.querySelector('[data-panel][id="trace-side"]')).toBe(sidePanel);
  });

  it('stores the side column width in pixels once it is resized', async () => {
    render(<TraceDataPanelView {...props('agent')} />);
    await expectSideWidth(480);
    // Laying the columns out is not a resize: nothing is remembered until the user moves a separator.
    expect(localStorage.getItem(storageKey('agent'))).toBeNull();

    fireEvent.keyDown(screen.getAllByRole('separator')[0], { key: 'ArrowRight' });

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(storageKey('agent')) ?? '{}');
      expect(stored.side).toBeGreaterThan(480);
    });
  });
});

describe('TraceDataPanelView — pixel width correction', () => {
  it('applies each correction once while the columns keep changing width', async () => {
    // A drawer widening under the columns: every measurement comes back a little wider, so the
    // pixel widths never land exactly on a measured layout.
    let measured = 0;
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute('data-separator')) return 0;
      if (!this.hasAttribute('data-panel')) return GROUP_WIDTH;
      measured += 1;
      return GROUP_WIDTH / (this.parentElement?.querySelectorAll(':scope > [data-panel]').length ?? 1) + measured;
    });
    // Microtasks never yield to the page: a correction that schedules another one freezes the tab.
    // Past the bound the loop is cut so the test can fail instead of hanging.
    const queueMicrotask = globalThis.queueMicrotask.bind(globalThis);
    let queued = 0;
    let runaway = false;
    vi.stubGlobal('queueMicrotask', (callback: VoidFunction) => {
      queued += 1;
      if (queued > 500) {
        runaway = true;
        return;
      }
      queueMicrotask(callback);
    });

    render(<TraceDataPanelView {...props('workflow_run')} spanPanelSlot={<div>span details</div>} />);

    await screen.findByText('span details');
    await waitFor(() => expect(Number(sidePanelFlexGrow())).toBeGreaterThan(0));
    expect(runaway).toBe(false);
  });
});
