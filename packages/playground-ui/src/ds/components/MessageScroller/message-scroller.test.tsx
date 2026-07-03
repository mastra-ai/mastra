// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessageScrollerContent, MessageScrollerItem, MessageScrollerViewport } from './message-scroller';
import { MessageScrollerProvider } from './message-scroller-context';
import { ThreadRail } from './thread-rail';
import type { ThreadRailTurn } from './thread-rail-turns';

const turns: ThreadRailTurn[] = [
  { key: 'turn-1', messageId: 'message-1', prompt: 'First turn', files: [], hiddenFileCount: 0 },
  { key: 'turn-2', messageId: 'message-2', prompt: 'Second turn', files: [], hiddenFileCount: 0 },
];

type MockIntersectionObserverEntry = {
  target: Element;
  isIntersecting: boolean;
};

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

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

  takeRecords = () => [];

  trigger(entries: MockIntersectionObserverEntry[]) {
    this.callback(
      entries.map(
        entry =>
          ({
            target: entry.target,
            isIntersecting: entry.isIntersecting,
            boundingClientRect: entry.target.getBoundingClientRect(),
            intersectionRatio: entry.isIntersecting ? 1 : 0,
            intersectionRect: entry.target.getBoundingClientRect(),
            rootBounds: null,
            time: Date.now(),
          }) as IntersectionObserverEntry,
      ),
      this as unknown as IntersectionObserver,
    );
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

const setTop = (element: Element, top: number) => {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: vi.fn(() => createRect({ top })),
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
  MockIntersectionObserver.instances = [];
});

describe('MessageScroller', () => {
  it('falls back to the latest anchor and scrolls to a clicked rail turn', async () => {
    const originalIntersectionObserver = globalThis.IntersectionObserver;
    const originalScrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    const scrollIntoView = vi.fn();
    vi.stubGlobal('IntersectionObserver', undefined);
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });

    try {
      renderScroller();

      expect(screen.getByTestId('thread-rail-scroll-area')).toBeTruthy();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Jump to Second turn' }).getAttribute('aria-current')).toBe(
          'location',
        );
      });

      fireEvent.click(screen.getByRole('button', { name: 'Jump to First turn' }));

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    } finally {
      vi.stubGlobal('IntersectionObserver', originalIntersectionObserver);
      if (originalScrollIntoView) {
        Object.defineProperty(Element.prototype, 'scrollIntoView', originalScrollIntoView);
      } else {
        delete Element.prototype.scrollIntoView;
      }
    }
  });

  it('marks visible messages in view while keeping the current anchor active', async () => {
    const originalIntersectionObserver = globalThis.IntersectionObserver;
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    try {
      renderScroller();

      const viewport = screen.getByTestId('viewport');
      const firstMessage = document.querySelector('[data-message-scroller-id="message-1"]');
      const secondMessage = document.querySelector('[data-message-scroller-id="message-2"]');

      expect(firstMessage).toBeTruthy();
      expect(secondMessage).toBeTruthy();

      setTop(viewport, 100);
      setTop(firstMessage as Element, 90);
      setTop(secondMessage as Element, 140);

      await waitFor(() => {
        expect(MockIntersectionObserver.instances[0]?.observed.size).toBe(2);
      });

      await act(async () => {
        MockIntersectionObserver.instances[0]?.trigger([
          { target: firstMessage as Element, isIntersecting: false },
          { target: secondMessage as Element, isIntersecting: true },
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
    expect(screen.getByTestId('thread-rail-preview-current').className).toContain('duration-360');
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
