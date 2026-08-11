// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, assert, describe, expect, it, vi } from 'vitest';

import { ChatShell } from './index';

// jsdom has no layout engine, so the single-scroller and overlap rules can only
// be asserted through the classes and custom properties that carry them.
class MockResizeObserver implements ResizeObserver {
  static instances: MockResizeObserver[] = [];

  readonly observed = new Set<Element>();

  constructor(private readonly callback: ResizeObserverCallback) {
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

  trigger() {
    this.callback([], this);
  }
}

const renderShell = () =>
  render(
    <ChatShell className="[--chat-column:44rem]" data-testid="shell">
      <ChatShell.Bar data-testid="bar">
        <header>session bar</header>
      </ChatShell.Bar>
      <ChatShell.Stage>
        <ChatShell.Viewport data-testid="viewport">
          <ChatShell.Content data-testid="content">
            <ChatShell.Column data-testid="transcript-column">transcript</ChatShell.Column>
          </ChatShell.Content>
          <ChatShell.Dock data-testid="dock">
            <ChatShell.ScrollButton />
            <ChatShell.Column>composer</ChatShell.Column>
          </ChatShell.Dock>
        </ChatShell.Viewport>
      </ChatShell.Stage>
    </ChatShell>,
  );

const scrollersIn = (root: HTMLElement) =>
  [...root.querySelectorAll('*'), ...(root.className.includes('overflow-y-auto') ? [root] : [])].filter(element =>
    element.className.toString().includes('overflow-y-auto'),
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  MockResizeObserver.instances = [];
});

describe('ChatShell', () => {
  it('owns exactly one scroll container', () => {
    renderShell();

    expect(scrollersIn(screen.getByTestId('shell'))).toEqual([screen.getByTestId('viewport')]);
  });

  it('centres every region on one column definition', () => {
    renderShell();

    const columns = document.querySelectorAll('[data-slot="chat-shell-column"]');
    expect(columns.length).toBeGreaterThan(1);
    for (const column of columns) {
      expect(column.className).toContain('max-w-(--chat-column)');
      expect(column.className).toContain('mx-auto');
    }
    expect(screen.getByTestId('shell').className).toContain('[--chat-column:44rem]');
  });

  it('keeps the dock in flow and measures nothing', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    renderShell();

    const dock = screen.getByTestId('dock');
    // Feeding its height back into the scrolled boxes resizes what
    // MessageScrollerContent observes, so autoscroll fires on every keystroke.
    expect(MockResizeObserver.instances.some(observer => observer.observed.has(dock))).toBe(false);
    expect(screen.getByTestId('shell').getAttribute('style')).toBeNull();
    expect(dock.className).toContain('sticky');
    expect(dock.className).not.toContain('-mt-');
  });

  it('docks against a track spanning the scrolled height, not the scroller itself', () => {
    renderShell();

    const track = screen.getByTestId('viewport').querySelector('[data-slot="chat-shell-track"]');
    // A sticky direct child of the scroller is clamped to the scroller's own box.
    expect(screen.getByTestId('dock').parentElement).toBe(track);
    expect(track?.className).toContain('min-h-full');
  });

  it('veils the dock and leaves the air above it clear', () => {
    renderShell();

    const dock = screen.getByTestId('dock');
    // A background, not an overlay: it passes behind the composer card, dimming
    // the transcript in its rounded corners too.
    expect(dock.className).toContain('bg-(--chat-veil)');
    expect(dock.className).toContain('pb-(--chat-gutter)');
    // The matching room above belongs to the content, which paints nothing.
    expect(screen.getByTestId('content').className).toContain('pb-(--chat-gutter)');
    expect(screen.getByTestId('shell').className).toContain(
      '[--chat-veil:color-mix(in_oklab,var(--chat-surface)_70%,transparent)]',
    );
  });

  it('anchors the scroll button on the dock, not the page', () => {
    renderShell();

    const button = screen.getByRole('button', { name: 'Scroll to end' });
    // Outside the dock it centres on a box the scrollbar has not narrowed.
    assert(screen.getByTestId('dock').contains(button), 'Expected the scroll button inside the dock');
    const shell = screen.getByTestId('shell');
    expect(shell.className).toContain('relative');
    expect(shell.className).toContain('isolate');
  });

  it('pads its own scroller by the end inset so the column re-centres', () => {
    renderShell();

    expect(screen.getByTestId('viewport').className).toContain('pe-(--chat-inset-end)');
    expect(screen.getByTestId('shell').className).toContain('[--chat-inset-end:0px]');
    // The panel floats inside the stage, below the bars: insetting a bar only
    // notches the top edge of the page.
    expect(screen.getByTestId('bar').className).not.toContain('pe-(--chat-inset-end)');
  });
});
