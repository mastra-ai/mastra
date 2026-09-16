// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThreadRail } from '../ThreadRail/thread-rail';
import type { ThreadRailTurn } from '../ThreadRail/thread-rail-turns';

import {
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from './message-scroller';
import type { MessageScrollerDefaultScrollPosition } from './message-scroller';
import { startTrip } from './message-scroller-trip';

vi.mock('./message-scroller-trip', () => ({
  startTrip: vi.fn(() => ({ cancel: vi.fn() })),
}));

const startTripMock = vi.mocked(startTrip);

const lastTrip = () => {
  const call = startTripMock.mock.calls.at(-1);
  if (!call) throw new Error('No trip started');
  const [viewport, getTarget, onEnd] = call;
  return { viewport, getTarget, end: onEnd };
};

if (!Element.prototype.getAnimations) {
  Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: () => [] });
}

const turns: ThreadRailTurn[] = [
  { key: 'turn-1', messageId: 'message-1', prompt: 'First turn', files: [], hiddenFileCount: 0 },
  { key: 'turn-2', messageId: 'message-2', prompt: 'Second turn', files: [], hiddenFileCount: 0 },
];

type MockIntersectionObserverEntry = {
  target: Element;
  isIntersecting: boolean;
};

type MockResizeObserverEntry = {
  target: Element;
};

class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly root: Element | Document | null = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  readonly observed = new Set<Element>();
  readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe = (element: Element) => {
    this.observed.add(element);
  };

  unobserve = (element: Element) => {
    this.observed.delete(element);
  };

  disconnect = vi.fn();

  takeRecords = (): IntersectionObserverEntry[] => [];

  trigger(entries: MockIntersectionObserverEntry[]) {
    const observerEntries: IntersectionObserverEntry[] = entries.map(entry => ({
      target: entry.target,
      isIntersecting: entry.isIntersecting,
      boundingClientRect: entry.target.getBoundingClientRect(),
      intersectionRatio: entry.isIntersecting ? 1 : 0,
      intersectionRect: entry.target.getBoundingClientRect(),
      rootBounds: null,
      time: Date.now(),
    }));
    this.callback(observerEntries, this);
  }
}

class MockResizeObserver implements ResizeObserver {
  static instances: MockResizeObserver[] = [];

  readonly observed = new Set<Element>();
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe = (element: Element) => {
    this.observed.add(element);
  };

  unobserve = (element: Element) => {
    this.observed.delete(element);
  };

  disconnect = vi.fn(() => {
    this.observed.clear();
  });

  trigger(entries: MockResizeObserverEntry[]) {
    const observerEntries: ResizeObserverEntry[] = entries.map(entry => ({
      target: entry.target,
      contentRect: entry.target.getBoundingClientRect(),
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
    }));
    this.callback(observerEntries, this);
  }
}

const renderScroller = () =>
  render(
    <MessageScrollerProvider>
      <MessageScrollerViewport data-testid="viewport">
        <MessageScrollerContent>
          <MessageScrollerItem messageId="message-1" scrollAnchor>
            <div>First message</div>
          </MessageScrollerItem>
          <MessageScrollerItem messageId="message-2" scrollAnchor>
            <div>Second message</div>
          </MessageScrollerItem>
        </MessageScrollerContent>
      </MessageScrollerViewport>
      <ThreadRail turns={turns} />
    </MessageScrollerProvider>,
  );

const createRect = ({ top = 0, height = 40, width = 100 }: { top?: number; height?: number; width?: number } = {}) => ({
  top,
  bottom: top + height,
  left: 0,
  right: width,
  width,
  height,
  x: 0,
  y: top,
  toJSON: () => ({}),
});

const getItem = (messageId: string): HTMLElement => {
  const element = document.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
  if (!element) throw new Error(`No scroller item for ${messageId}`);
  return element;
};

const setTop = (element: Element, top: number) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: vi.fn(() => createRect({ top })),
  });
};

const setRect = (element: Element, rect: { top: number; height: number }) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: vi.fn(() => createRect(rect)),
  });
};

const mockPreviewSizerHeight = () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.dataset.testid === 'thread-rail-preview-sizer') {
      return createRect({ height: this.textContent?.includes('Second turn') ? 52 : 96 });
    }

    return createRect();
  });
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  startTripMock.mockClear();
  MockIntersectionObserver.instances = [];
  MockResizeObserver.instances = [];
});

describe('MessageScroller', () => {
  it('falls back to the latest anchor and scrolls to a clicked rail turn', async () => {
    const originalIntersectionObserver = globalThis.IntersectionObserver;
    const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
    const scrollTo = vi.fn();
    vi.stubGlobal('IntersectionObserver', undefined);
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: scrollTo,
    });

    try {
      renderScroller();

      expect(screen.getByTestId('thread-rail-scroll-area')).toBeTruthy();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Jump to Second turn' }).getAttribute('aria-current')).toBe(
          'location',
        );
      });

      const viewport = screen.getByTestId('viewport');
      Object.defineProperty(viewport, 'scrollTop', { configurable: true, writable: true, value: 20 });
      setTop(viewport, 0);
      setTop(getItem('message-1'), -20);

      fireEvent.click(screen.getByRole('button', { name: 'Jump to First turn' }));

      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    } finally {
      vi.stubGlobal('IntersectionObserver', originalIntersectionObserver);
      if (originalScrollTo) {
        Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo);
      } else {
        delete HTMLElement.prototype.scrollTo;
      }
    }
  });

  it('marks visible messages in view while keeping the current anchor active', async () => {
    const originalIntersectionObserver = globalThis.IntersectionObserver;
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    try {
      renderScroller();

      const viewport = screen.getByTestId('viewport');
      const firstMessage = getItem('message-1');
      const secondMessage = getItem('message-2');

      setTop(viewport, 100);
      setTop(firstMessage, 90);
      setTop(secondMessage, 180);

      await waitFor(() => {
        expect(MockIntersectionObserver.instances[0]?.observed.size).toBe(2);
      });

      await act(async () => {
        MockIntersectionObserver.instances[0]?.trigger([
          { target: firstMessage, isIntersecting: false },
          { target: secondMessage, isIntersecting: true },
        ]);
      });

      const firstTurn = screen.getByRole('button', { name: 'Jump to First turn' });
      const secondTurn = screen.getByRole('button', { name: 'Jump to Second turn' });

      await waitFor(() => {
        expect(firstTurn.getAttribute('aria-current')).toBe('location');
        expect(firstTurn.getAttribute('data-active')).toBe('true');
        expect(firstTurn.getAttribute('data-in-view')).toBeNull();
        expect(secondTurn.getAttribute('data-in-view')).toBe('true');
      });
    } finally {
      vi.stubGlobal('IntersectionObserver', originalIntersectionObserver);
    }
  });

  it('updates scrollability when the viewport resizes', async () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    try {
      renderScroller();

      const viewport = screen.getByTestId('viewport');
      Object.defineProperty(viewport, 'scrollTop', { configurable: true, writable: true, value: 0 });
      Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 80 });
      Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 200 });

      await waitFor(() => {
        expect(MockResizeObserver.instances.some(instance => instance.observed.has(viewport))).toBe(true);
      });

      const viewportObserver = MockResizeObserver.instances.find(instance => instance.observed.has(viewport));
      if (!viewportObserver) throw new Error('No resize observer registered for viewport');

      await act(async () => {
        viewportObserver.trigger([{ target: viewport }]);
      });

      await waitFor(() => {
        expect(viewport.getAttribute('data-scrollable')).toBe('end');
      });
    } finally {
      vi.stubGlobal('ResizeObserver', originalResizeObserver);
    }
  });

  it('keeps one preview shell while animating enter, switch, and exit', async () => {
    mockPreviewSizerHeight();
    renderScroller();

    const firstTurn = screen.getByRole('button', { name: 'Jump to First turn' });
    const secondTurn = screen.getByRole('button', { name: 'Jump to Second turn' });
    const rail = screen.getByTestId('thread-rail');

    setTop(rail, 100);
    setTop(firstTurn, 120);
    setTop(secondTurn, 180);

    fireEvent.mouseEnter(firstTurn);

    const preview = screen.getByTestId('thread-rail-preview');
    const previewId = preview.getAttribute('id');
    const viewport = screen.getByTestId('thread-rail-preview-viewport');
    expect(firstTurn.getAttribute('aria-describedby')).toBe(previewId);
    expect(preview.className).toContain('overflow-hidden');
    expect(preview.className).toContain('transition-[height,translate,opacity]');
    expect(preview.className).toContain('duration-360');
    expect(preview.className).toContain('ease-out-custom');
    expect(preview.className).toContain('opacity-0');
    expect(preview.style.translate).toBe('0 calc(40px - 50%)');
    expect(preview.style.height).toBe('96px');
    expect(viewport.className).not.toContain('overflow-hidden');
    expect(within(screen.getByTestId('thread-rail-preview-sizer')).getByText('First turn')).toBeTruthy();
    expect(screen.getByTestId('thread-rail-preview-current').className).toContain('duration-150');
    expect(screen.getByTestId('thread-rail-preview-current').className).toContain('ease-in-out');
    expect(screen.getByTestId('thread-rail-preview-current').className).toContain('scale-95');
    expect(screen.getByTestId('thread-rail-preview-current').className).toContain('blur-xs');
    expect(within(screen.getByTestId('thread-rail-preview-current')).getByText('First turn')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId('thread-rail-preview').getAttribute('data-visible')).toBe('true');
      expect(screen.getByTestId('thread-rail-preview-current').className).toContain('opacity-100');
      expect(screen.getByTestId('thread-rail-preview-current').className).toContain('scale-100');
      expect(screen.getByTestId('thread-rail-preview-current').className).toContain('blur-none');
    });

    const firstCurrentLayer = screen.getByTestId('thread-rail-preview-current');

    fireEvent.mouseEnter(secondTurn);

    expect(screen.getByTestId('thread-rail-preview')).toBe(preview);
    expect(secondTurn.getAttribute('aria-describedby')).toBe(previewId);
    expect(preview.style.translate).toBe('0 calc(100px - 50%)');
    await waitFor(() => {
      expect(preview.style.height).toBe('52px');
    });
    expect(within(screen.getByTestId('thread-rail-preview-sizer')).queryByText('First turn')).toBeNull();
    expect(within(screen.getByTestId('thread-rail-preview-sizer')).getByText('Second turn')).toBeTruthy();

    const switchCurrentLayer = screen.getByTestId('thread-rail-preview-current');
    const switchPreviousLayer = screen.getByTestId('thread-rail-preview-previous');
    expect(switchCurrentLayer).not.toBe(firstCurrentLayer);
    expect(switchPreviousLayer.className).toContain('opacity-100');
    expect(switchPreviousLayer.className).toContain('scale-100');
    expect(switchPreviousLayer.className).toContain('blur-none');
    expect(within(switchPreviousLayer).getByText('First turn')).toBeTruthy();
    expect(screen.getByTestId('thread-rail-preview-current').className).toContain('opacity-0');
    expect(screen.getByTestId('thread-rail-preview-current').className).toContain('scale-95');
    expect(screen.getByTestId('thread-rail-preview-current').className).toContain('blur-xs');
    expect(within(screen.getByTestId('thread-rail-preview-current')).getByText('Second turn')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId('thread-rail-preview-current').className).toContain('opacity-100');
      expect(screen.getByTestId('thread-rail-preview-current').className).toContain('scale-100');
      expect(screen.getByTestId('thread-rail-preview-current').className).toContain('blur-none');
      expect(screen.getByTestId('thread-rail-preview-previous').className).toContain('opacity-0');
      expect(screen.getByTestId('thread-rail-preview-previous').className).toContain('scale-95');
      expect(screen.getByTestId('thread-rail-preview-previous').className).toContain('blur-xs');
    });

    fireEvent.mouseLeave(screen.getByTestId('thread-rail'));

    expect(screen.getByTestId('thread-rail-preview')).toBe(preview);
    expect(screen.getByTestId('thread-rail-preview').getAttribute('data-visible')).toBeNull();
    expect(preview.className).toContain('opacity-0');
    expect(screen.getByTestId('thread-rail-preview-current').className).toContain('opacity-0');
    expect(screen.getByTestId('thread-rail-preview-current').className).toContain('scale-95');
    expect(screen.getByTestId('thread-rail-preview-current').className).toContain('blur-xs');

    await waitFor(() => {
      expect(screen.queryByTestId('thread-rail-preview')).toBeNull();
    });
  });
});

const setScrollMetrics = (
  element: HTMLElement,
  metrics: { scrollHeight: number; clientHeight: number; scrollTop: number },
) => {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: metrics.scrollHeight });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: metrics.clientHeight });
  element.scrollTop = metrics.scrollTop;
};

// Only a scroll back up detaches a reader, so detaching one takes two moves: end, then up.
const scrollReaderTo = (
  element: HTMLElement,
  metrics: { scrollHeight: number; clientHeight: number; scrollTop: number },
) => {
  setScrollMetrics(element, metrics);
  fireEvent.scroll(element);
};

const installScrollTo = (element: HTMLElement) => {
  const scrollTo = vi.fn((options?: ScrollToOptions | number) => {
    if (typeof options === 'object' && typeof options.top === 'number') element.scrollTop = options.top;
    if (typeof options === 'number') element.scrollTop = options;
  });
  element.scrollTo = scrollTo;
  return scrollTo;
};

const HistoryHarness = ({
  autoScroll = false,
  defaultScrollPosition,
  messageIds,
  onReachStart,
  replyIds = [],
}: {
  autoScroll?: boolean;
  defaultScrollPosition?: MessageScrollerDefaultScrollPosition;
  messageIds: string[];
  onReachStart?: () => void;
  replyIds?: string[];
}) => (
  <MessageScrollerProvider
    autoScroll={autoScroll}
    defaultScrollPosition={defaultScrollPosition}
    preserveScrollOnPrepend
    onReachStart={onReachStart}
  >
    <MessageScrollerViewport data-testid="history-viewport">
      <MessageScrollerContent>
        {messageIds.map(messageId => (
          <MessageScrollerItem key={messageId} messageId={messageId} scrollAnchor>
            <div>{messageId}</div>
          </MessageScrollerItem>
        ))}
        {replyIds.map(replyId => (
          <MessageScrollerItem key={replyId} messageId={replyId}>
            <div>{replyId}</div>
          </MessageScrollerItem>
        ))}
      </MessageScrollerContent>
    </MessageScrollerViewport>
  </MessageScrollerProvider>
);

const MarkerHarness = ({ markerIds = [], messageIds }: { markerIds?: string[]; messageIds: string[] }) => (
  <MessageScrollerProvider autoScroll>
    <MessageScrollerViewport data-testid="marker-viewport">
      <MessageScrollerContent>
        {markerIds.map(markerId => (
          <MessageScrollerItem key={markerId} messageId={markerId}>
            <div>{markerId}</div>
          </MessageScrollerItem>
        ))}
        {messageIds.map(messageId => (
          <MessageScrollerItem key={messageId} messageId={messageId} scrollAnchor>
            <div>{messageId}</div>
          </MessageScrollerItem>
        ))}
      </MessageScrollerContent>
    </MessageScrollerViewport>
  </MessageScrollerProvider>
);

const HistoryRailHarness = ({ messageIds }: { messageIds: string[] }) => (
  <MessageScrollerProvider>
    <MessageScrollerViewport data-testid="history-rail-viewport">
      <MessageScrollerContent>
        {messageIds.map(messageId => (
          <MessageScrollerItem key={messageId} messageId={messageId} scrollAnchor>
            <div>{messageId}</div>
          </MessageScrollerItem>
        ))}
      </MessageScrollerContent>
    </MessageScrollerViewport>
    <ThreadRail
      turns={messageIds.map(messageId => ({
        key: messageId,
        messageId,
        prompt: messageId,
        files: [],
        hiddenFileCount: 0,
      }))}
    />
  </MessageScrollerProvider>
);

const TurnHarness = ({ messageIds, replyIds = [] }: { messageIds: string[]; replyIds?: string[] }) => (
  <MessageScrollerProvider defaultScrollPosition="last-anchor">
    <MessageScrollerViewport data-testid="turn-viewport">
      <MessageScrollerContent>
        {messageIds.map(messageId => (
          <MessageScrollerItem key={messageId} messageId={messageId} scrollAnchor>
            <div>{messageId}</div>
          </MessageScrollerItem>
        ))}
        {replyIds.map(replyId => (
          <MessageScrollerItem key={replyId} messageId={replyId}>
            <div>{replyId}</div>
          </MessageScrollerItem>
        ))}
      </MessageScrollerContent>
    </MessageScrollerViewport>
  </MessageScrollerProvider>
);

const ReconciledTurnHarness = ({ messageId }: { messageId: string }) => (
  <MessageScrollerProvider defaultScrollPosition="last-anchor">
    <MessageScrollerViewport data-testid="reconciled-turn-viewport">
      <MessageScrollerContent>
        <MessageScrollerItem key="stable-turn" messageId={messageId} scrollAnchor>
          <div>{messageId}</div>
        </MessageScrollerItem>
      </MessageScrollerContent>
    </MessageScrollerViewport>
  </MessageScrollerProvider>
);

const stubLayout = (tops: Record<string, number>) => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const top = this.dataset.messageId ? tops[this.dataset.messageId] : undefined;
    return createRect({ top: top ?? 0 });
  });
};

const getContent = (): HTMLElement => {
  const content = document.querySelector<HTMLElement>('[data-slot="message-scroller-content"]');
  if (!content) throw new Error('No scroller content');
  return content;
};

const contentResizeObserver = () => {
  const content = getContent();
  const observer = MockResizeObserver.instances.find(instance => instance.observed.has(content));
  if (!observer) throw new Error('No resize observer registered for content');
  return { content, observer };
};

describe('MessageScroller older history', () => {
  it('tracks the active anchor in document order after older messages are prepended', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { rerender } = render(<HistoryRailHarness messageIds={['message-3', 'message-4']} />);
    const viewport = screen.getByTestId('history-rail-viewport');
    installScrollTo(viewport);
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 200 });
    setTop(viewport, 100);
    setTop(getItem('message-3'), 80);
    setTop(getItem('message-4'), 180);
    fireEvent.scroll(viewport);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Jump to message-3' }).getAttribute('aria-current')).toBe('location');
    });

    rerender(<HistoryRailHarness messageIds={['message-1', 'message-2', 'message-3', 'message-4']} />);
    setTop(getItem('message-1'), -120);
    setTop(getItem('message-2'), -20);
    setTop(getItem('message-3'), 80);
    setTop(getItem('message-4'), 180);
    fireEvent.scroll(viewport);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Jump to message-3' }).getAttribute('aria-current')).toBe('location');
    });
  });

  it('does not request older history before the transcript has settled at the end', () => {
    const onReachStart = vi.fn();
    render(<HistoryHarness messageIds={['message-1']} onReachStart={onReachStart} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);
    // The mount lands at the very top of a tall transcript — indistinguishable
    // from a reader asking for older messages, and the source of a fetch loop.
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });
    fireEvent.scroll(viewport);

    expect(onReachStart).not.toHaveBeenCalled();
  });

  it('requests older history once the reader settles at the end and returns to the start', () => {
    const onReachStart = vi.fn();
    render(<HistoryHarness messageIds={['message-1']} onReachStart={onReachStart} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);

    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    fireEvent.scroll(viewport);
    expect(onReachStart).not.toHaveBeenCalled();

    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });
    fireEvent.scroll(viewport);
    expect(onReachStart).toHaveBeenCalledTimes(1);

    // Still at the start with the fetch in flight — no second request.
    fireEvent.scroll(viewport);
    expect(onReachStart).toHaveBeenCalledTimes(1);
  });

  it('does not request older history again when messages append while the reader remains at the start', () => {
    const onReachStart = vi.fn();
    const { rerender } = render(<HistoryHarness messageIds={['message-1']} onReachStart={onReachStart} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);

    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    fireEvent.scroll(viewport);
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });
    fireEvent.scroll(viewport);
    expect(onReachStart).toHaveBeenCalledTimes(1);

    rerender(<HistoryHarness messageIds={['message-1', 'message-2']} onReachStart={onReachStart} />);
    fireEvent.scroll(viewport);

    expect(onReachStart).toHaveBeenCalledTimes(1);
  });

  it('requests another history page after a small prepend keeps the reader near the start', () => {
    const onReachStart = vi.fn();
    const { rerender } = render(<HistoryHarness messageIds={['message-2']} onReachStart={onReachStart} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);

    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    fireEvent.scroll(viewport);
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });
    fireEvent.scroll(viewport);
    expect(onReachStart).toHaveBeenCalledTimes(1);

    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1100 });
    rerender(<HistoryHarness messageIds={['message-1', 'message-2']} onReachStart={onReachStart} />);

    expect(viewport.scrollTop).toBe(100);
    fireEvent.scroll(viewport);
    expect(onReachStart).toHaveBeenCalledTimes(2);
  });

  it('holds the reading position when older messages are prepended', () => {
    const onReachStart = vi.fn();
    const { rerender } = render(<HistoryHarness messageIds={['message-3']} onReachStart={onReachStart} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);

    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    fireEvent.scroll(viewport);
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });
    fireEvent.scroll(viewport);
    expect(onReachStart).toHaveBeenCalledTimes(1);

    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1600 });
    rerender(<HistoryHarness messageIds={['message-1', 'message-2', 'message-3']} onReachStart={onReachStart} />);

    expect(viewport.scrollTop).toBe(600);
  });
});

describe('MessageScroller turn anchoring', () => {
  it('opens an asynchronously loaded transcript at its latest turn after layout settles', () => {
    let layoutReady = false;
    const scheduledScrolls: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      scheduledScrolls.push(callback);
      return scheduledScrolls.length;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const top = layoutReady && this.dataset.messageId === 'message-1' ? 100 : 0;
      if (layoutReady && this.dataset.messageId === 'message-2') return createRect({ top: 700 });
      return createRect({ top });
    });
    const { rerender } = render(<TurnHarness messageIds={[]} />);

    const viewport = screen.getByTestId('turn-viewport');
    const scrollTo = installScrollTo(viewport);
    setScrollMetrics(viewport, { scrollHeight: 1200, clientHeight: 400, scrollTop: 250 });

    rerender(<TurnHarness messageIds={['message-1', 'message-2']} />);
    expect(scrollTo).not.toHaveBeenCalled();

    act(() => scheduledScrolls.shift()?.(0));
    expect(scrollTo).not.toHaveBeenCalled();

    layoutReady = true;
    act(() => scheduledScrolls.shift()?.(16));

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 950, behavior: 'auto' });
  });

  it('parks the first send of a thread whose default scroll settled with no anchor after it', () => {
    let layoutReady = false;
    const scheduledScrolls: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      scheduledScrolls.push(callback);
      return scheduledScrolls.length;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (layoutReady && this.dataset.messageId === 'message-2') return createRect({ top: 700 });
      if (layoutReady && this.dataset.messageId === 'message-3') return createRect({ top: 1100 });
      return createRect({ top: 0 });
    });
    const { rerender } = render(<TurnHarness messageIds={[]} />);

    const viewport = screen.getByTestId('turn-viewport');
    const scrollTo = installScrollTo(viewport);
    setScrollMetrics(viewport, { scrollHeight: 1200, clientHeight: 400, scrollTop: 250 });

    rerender(<TurnHarness messageIds={['message-1', 'message-2']} />);
    act(() => scheduledScrolls.shift()?.(0));
    layoutReady = true;
    act(() => scheduledScrolls.shift()?.(16));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 950, behavior: 'auto' });

    rerender(<TurnHarness messageIds={['message-1', 'message-2', 'message-3']} />);

    expect(startTripMock).toHaveBeenCalledTimes(1);
    expect(lastTrip().getTarget()).toBe(800);
  });

  it('parks a turn that opens below the ones already read at the top of the viewport', () => {
    stubLayout({ 'message-2': 300 });
    const { rerender } = render(<TurnHarness messageIds={['message-1']} />);

    const viewport = screen.getByTestId('turn-viewport');
    const scrollTo = installScrollTo(viewport);
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 0 });

    // The first message of a fresh thread opens at the top it already sits on.
    expect(startTripMock).not.toHaveBeenCalled();

    rerender(<TurnHarness messageIds={['message-1', 'message-2']} />);

    expect(startTripMock).toHaveBeenCalledTimes(1);
    expect(lastTrip().getTarget()).toBe(300);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does not re-anchor a turn when reconciliation replaces its message id', () => {
    stubLayout({ 'client-message': 300, 'server-message': 300 });
    const { rerender } = render(<ReconciledTurnHarness messageId="client-message" />);

    const viewport = screen.getByTestId('reconciled-turn-viewport');
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 300 });
    const scrollTo = installScrollTo(viewport);

    rerender(<ReconciledTurnHarness messageId="server-message" />);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('stays put while the reply streams in below the turn', () => {
    stubLayout({ 'message-1': 300 });
    const { rerender } = render(<TurnHarness messageIds={['message-1']} />);

    const viewport = screen.getByTestId('turn-viewport');
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 300 });
    const scrollTo = installScrollTo(viewport);

    rerender(<TurnHarness messageIds={['message-1']} replyIds={['reply-1']} />);

    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe('MessageScroller autoScroll', () => {
  it('follows content that grows while the reader sits at the end', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    render(<HistoryHarness autoScroll messageIds={['message-1']} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    fireEvent.scroll(viewport);

    const { content, observer } = contentResizeObserver();
    const scrollTo = installScrollTo(viewport);
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1400 });

    await act(async () => {
      observer.trigger([{ target: content }]);
    });

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1000, behavior: 'auto' });
  });

  it('stays attached when a scroll lands behind a reply that is still growing', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    render(<HistoryHarness autoScroll messageIds={['message-1']} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);
    scrollReaderTo(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });

    const { content, observer } = contentResizeObserver();
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1400 });
    await act(async () => {
      observer.trigger([{ target: content }]);
    });

    // The follow lands on the end of the frame it measured, and the scroll event
    // for it arrives once the reply has already grown past that.
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1800 });
    fireEvent.scroll(viewport);

    const scrollTo = installScrollTo(viewport);
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 2200 });
    await act(async () => {
      observer.trigger([{ target: content }]);
    });

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1800, behavior: 'auto' });
  });

  it('leaves a reopened thread on the turn it restored instead of following the stream', () => {
    stubLayout({ 'message-1': 0, 'message-2': 300 });
    const { rerender } = render(
      <HistoryHarness autoScroll defaultScrollPosition="last-anchor" messageIds={['message-1', 'message-2']} />,
    );

    const viewport = screen.getByTestId('history-viewport');
    const scrollTo = installScrollTo(viewport);
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 300 });

    // Rows registering after the restore must not be read as the reader riding the stream.
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1400 });
    rerender(
      <HistoryHarness
        autoScroll
        defaultScrollPosition="last-anchor"
        messageIds={['message-1', 'message-2']}
        replyIds={['reply-1']}
      />,
    );

    expect(scrollTo).not.toHaveBeenCalled();
    expect(startTripMock).not.toHaveBeenCalled();
  });

  it.each([
    { defaultScrollPosition: 'start', landsOn: 0 },
    { defaultScrollPosition: 'last-anchor', landsOn: 550 },
  ] as const)(
    'opens an asynchronously loaded transcript at its $defaultScrollPosition before following anything',
    ({ defaultScrollPosition, landsOn }) => {
      const frames: FrameRequestCallback[] = [];
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => frames.push(callback));
      stubLayout({ 'message-1': 0, 'message-2': 300 });
      const { rerender } = render(
        <HistoryHarness autoScroll defaultScrollPosition={defaultScrollPosition} messageIds={[]} />,
      );

      const viewport = screen.getByTestId('history-viewport');
      const scrollTo = installScrollTo(viewport);
      setScrollMetrics(viewport, { scrollHeight: 1200, clientHeight: 400, scrollTop: 250 });

      rerender(
        <HistoryHarness
          autoScroll
          defaultScrollPosition={defaultScrollPosition}
          messageIds={['message-1', 'message-2']}
        />,
      );
      expect(scrollTo).not.toHaveBeenCalled();

      act(() => frames.shift()?.(0));
      act(() => frames.shift()?.(16));
      expect(scrollTo).toHaveBeenLastCalledWith({ top: landsOn, behavior: 'auto' });

      scrollTo.mockClear();
      Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1600 });
      rerender(
        <HistoryHarness
          autoScroll
          defaultScrollPosition={defaultScrollPosition}
          messageIds={['message-1', 'message-2']}
          replyIds={['reply-1']}
        />,
      );

      expect(scrollTo).not.toHaveBeenCalled();
    },
  );

  it('parks a turn at the top of the view when it opens, however far the box runs on', () => {
    stubLayout({ 'message-2': 300 });
    const { rerender } = render(<HistoryHarness autoScroll messageIds={['message-1']} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    fireEvent.scroll(viewport);

    const scrollTo = installScrollTo(viewport);
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1400 });
    rerender(<HistoryHarness autoScroll messageIds={['message-1', 'message-2']} />);

    // The end of the box is 1000, and a turn reserving room for its answer is why:
    // going there would carry the message just sent out of the view above.
    expect(startTripMock).toHaveBeenCalledTimes(1);
    expect(lastTrip().getTarget()).toBe(900);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('parks a turn one room above the end when the box stops short of the top', () => {
    stubLayout({ 'message-2': 300 });
    const { rerender } = render(<HistoryHarness autoScroll messageIds={['message-1']} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    fireEvent.scroll(viewport);

    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1100 });
    rerender(<HistoryHarness autoScroll messageIds={['message-1', 'message-2']} />);

    // Resting the message at the very top would take 900; the box ends at 700, and
    // aiming past it would leave the trip chasing a write the browser clamps.
    expect(startTripMock).toHaveBeenCalledTimes(1);
    expect(lastTrip().getTarget()).toBe(700);
  });

  it('trips on a short thread whose room has not opened yet, and rides it open', () => {
    stubLayout({ 'message-2': 300 });
    const { rerender } = render(<HistoryHarness autoScroll messageIds={['message-1']} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);
    setScrollMetrics(viewport, { scrollHeight: 400, clientHeight: 400, scrollTop: 0 });
    fireEvent.scroll(viewport);

    rerender(<HistoryHarness autoScroll messageIds={['message-1', 'message-2']} />);

    // A short thread has no scroll extent the instant its turn mounts — the new
    // message only ate the column's slack. The trip must still start, going nowhere…
    expect(startTripMock).toHaveBeenCalledTimes(1);
    expect(lastTrip().getTarget()).toBe(0);

    // …because its destination is re-read as the room opens under it.
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1000 });
    expect(lastTrip().getTarget()).toBe(300);
  });

  it('brings a reader who left back to the turn they opened, and carries them again', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    stubLayout({ 'message-2': 300 });
    const { rerender } = render(<HistoryHarness autoScroll messageIds={['message-1']} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);
    scrollReaderTo(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    scrollReaderTo(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 200 });

    const scrollTo = installScrollTo(viewport);
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1400 });
    rerender(<HistoryHarness autoScroll messageIds={['message-1', 'message-2']} />);

    expect(startTripMock).toHaveBeenCalledTimes(1);
    expect(lastTrip().getTarget()).toBe(500);

    // The trip lands with the turn parked at the top of the view.
    setTop(getItem('message-2'), 0);
    viewport.scrollTop = 500;
    act(() => lastTrip().end('arrived'));

    // The answer growing into the room its turn reserved moves nothing…
    const { content, observer } = contentResizeObserver();
    setRect(content, { top: -500, height: 1800 });
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1800 });
    await act(async () => {
      observer.trigger([{ target: content }]);
    });
    expect(scrollTo).not.toHaveBeenCalled();

    // …and re-attached by the turn, not by the reader having to chase it: only an
    // answer outgrowing that room moves the view again.
    setRect(getItem('message-2'), { top: 0, height: 900 });
    await act(async () => {
      observer.trigger([{ target: content }]);
    });

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1000, behavior: 'auto' });
  });

  it('holds a parked turn still when the reply starts streaming under it', () => {
    stubLayout({ 'message-2': 300 });
    const { rerender } = render(<HistoryHarness autoScroll messageIds={['message-1']} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);
    scrollReaderTo(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });

    const scrollTo = installScrollTo(viewport);
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1400 });
    rerender(<HistoryHarness autoScroll messageIds={['message-1', 'message-2']} />);
    expect(startTripMock).toHaveBeenCalledTimes(1);

    setTop(getItem('message-2'), 0);
    viewport.scrollTop = 900;
    act(() => lastTrip().end('arrived'));
    setRect(getContent(), { top: -900, height: 1400 });

    // The reply's first row lands inside the reserved room, above the fold: pulling
    // the view back to the end would carry the parked message up and away.
    rerender(<HistoryHarness autoScroll messageIds={['message-1', 'message-2']} replyIds={['reply-1']} />);

    expect(scrollTo).not.toHaveBeenCalled();
    expect(startTripMock).toHaveBeenCalledTimes(1);
  });

  it('holds the reading position when a marker lands above the reader', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    const { rerender } = render(<MarkerHarness messageIds={['message-1']} />);

    const viewport = screen.getByTestId('marker-viewport');
    installScrollTo(viewport);
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    fireEvent.scroll(viewport);

    const scrollTo = installScrollTo(viewport);
    // A temporal marker persisted mid-run lands above the turn the reader is on:
    // the transcript gets taller without them having moved.
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1040 });
    rerender(<MarkerHarness markerIds={['marker-1']} messageIds={['message-1']} />);

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 640, behavior: 'auto' });
  });

  it('leaves a parking trip alone while the room opens under it', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    stubLayout({ 'message-2': 300 });
    const { rerender } = render(<HistoryHarness autoScroll messageIds={['message-1']} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);
    scrollReaderTo(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    scrollReaderTo(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 200 });

    const scrollTo = installScrollTo(viewport);
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1400 });
    rerender(<HistoryHarness autoScroll messageIds={['message-1', 'message-2']} />);
    expect(startTripMock).toHaveBeenCalledTimes(1);

    const { content, observer } = contentResizeObserver();
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1800 });
    await act(async () => {
      observer.trigger([{ target: content }]);
    });

    // The trip re-reads its destination every frame: the room opening under it
    // neither restarts it nor surrenders the reader to the end.
    expect(startTripMock).toHaveBeenCalledTimes(1);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('hands the viewport back to a reader who interrupts the trip', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    stubLayout({ 'message-2': 300 });
    const { rerender } = render(<HistoryHarness autoScroll messageIds={['message-1']} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);
    scrollReaderTo(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });

    const scrollTo = installScrollTo(viewport);
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1400 });
    rerender(<HistoryHarness autoScroll messageIds={['message-1', 'message-2']} />);
    expect(startTripMock).toHaveBeenCalledTimes(1);

    // The reader grabs the wheel mid-flight: the trip lets go where they are.
    setScrollMetrics(viewport, { scrollHeight: 1400, clientHeight: 400, scrollTop: 300 });
    fireEvent.scroll(viewport);
    act(() => lastTrip().end('interrupted'));

    const { content, observer } = contentResizeObserver();
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1800 });
    await act(async () => {
      observer.trigger([{ target: content }]);
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('never offers to jump to an end it is already carrying the reader to', () => {
    const { rerender } = render(<HistoryHarness autoScroll messageIds={['message-1']} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);
    setScrollMetrics(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    fireEvent.scroll(viewport);

    // The turn opens under a reader already at the end: parked on the spot, with
    // the end far below — but theirs to keep, not to be offered.
    viewport.scrollTo = vi.fn();
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1400 });
    rerender(<HistoryHarness autoScroll messageIds={['message-1', 'message-2']} />);

    expect(viewport.getAttribute('data-scrollable')).toBe('start');

    setScrollMetrics(viewport, { scrollHeight: 1400, clientHeight: 400, scrollTop: 200 });
    fireEvent.scroll(viewport);

    expect(viewport.getAttribute('data-scrollable')).toBe('start end');
  });

  it('takes the button back in the same frame a new turn re-attaches the reader', () => {
    const { rerender } = render(<HistoryHarness autoScroll messageIds={['message-1']} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);
    scrollReaderTo(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    scrollReaderTo(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 200 });
    expect(viewport.getAttribute('data-scrollable')).toBe('start end');

    viewport.scrollTo = vi.fn();
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1400 });
    rerender(<HistoryHarness autoScroll messageIds={['message-1', 'message-2']} />);

    expect(viewport.getAttribute('data-scrollable')).toBe('start');
  });

  it('leaves the reader alone once they have scrolled away from the end', async () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    render(<HistoryHarness autoScroll messageIds={['message-1']} />);

    const viewport = screen.getByTestId('history-viewport');
    installScrollTo(viewport);
    scrollReaderTo(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 });
    scrollReaderTo(viewport, { scrollHeight: 1000, clientHeight: 400, scrollTop: 200 });

    const { content, observer } = contentResizeObserver();
    const scrollTo = installScrollTo(viewport);
    Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1400 });

    await act(async () => {
      observer.trigger([{ target: content }]);
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
