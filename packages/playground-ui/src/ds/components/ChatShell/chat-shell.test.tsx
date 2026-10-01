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
        </ChatShell.Viewport>
        <ChatShell.Dock data-testid="dock">
          <ChatShell.ScrollButton />
          <ChatShell.Column>composer</ChatShell.Column>
        </ChatShell.Dock>
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

  it('docks the composer under the scroller, measuring nothing', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    renderShell();

    const dock = screen.getByTestId('dock');
    // Feeding its height back into the scrolled boxes resizes what
    // MessageScrollerContent observes, so autoscroll fires on every keystroke.
    expect(MockResizeObserver.instances.some(observer => observer.observed.has(dock))).toBe(false);
    expect(screen.getByTestId('shell').getAttribute('style')).toBeNull();
    // A sibling after the scroller, so neither the transcript nor the scrollbar runs behind it.
    expect(dock.previousElementSibling).toBe(screen.getByTestId('viewport'));
    expect(dock.className).not.toContain('sticky');
  });

  it('pins the fade against a track spanning the scrolled height, not the scroller itself', () => {
    renderShell();

    const track = screen.getByTestId('viewport').querySelector('[data-slot="chat-shell-track"]');
    // A sticky direct child of the scroller is clamped to the scroller's own box.
    expect(track?.lastElementChild?.getAttribute('data-slot')).toBe('chat-shell-fade');
    expect(track?.className).toContain('min-h-full');
    // An overlay pinned to the scroller itself spans one screen, not the transcript.
    expect(track?.className).toContain('relative');
  });

  it('fades the transcript out over its own band of air, never past full strength', () => {
    renderShell();

    const fade = screen.getByTestId('viewport').querySelector('[data-slot="chat-shell-fade"]');
    // The band is also the air under the last row, so a still transcript ends clear of it.
    expect(fade?.className).toContain('sticky');
    expect(fade?.className).toContain('h-(--chat-fade)');
    expect(fade?.className).toContain(
      '[mask-image:linear-gradient(to_bottom,transparent,rgb(0_0_0/var(--chat-veil)))]',
    );
    expect(screen.getByTestId('dock').className).toContain('pb-(--chat-gutter)');
    expect(screen.getByTestId('content').className).not.toContain('pb-');
    expect(screen.getByTestId('shell').className).toContain('[--chat-fade:2rem]');
    expect(screen.getByTestId('shell').className).toContain('[--chat-veil:100%]');
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
    expect(screen.getByTestId('dock').className).toContain('pe-(--chat-inset-end)');
    expect(screen.getByTestId('shell').className).toContain('[--chat-inset-end:0px]');
    // The panel floats inside the stage, below the bars: insetting a bar only
    // notches the top edge of the page.
    expect(screen.getByTestId('bar').className).not.toContain('pe-(--chat-inset-end)');
  });
});

describe('ChatShell.Turn', () => {
  afterEach(cleanup);

  it('reserves the reply room only while the turn holds it, and lets a restored turn skip the opening', () => {
    render(
      <>
        <ChatShell.Turn data-testid="settled" opensTurn />
        <ChatShell.Turn data-testid="live" opensTurn holdsRoom />
        <ChatShell.Turn data-testid="restored" opensTurn holdsRoom restored />
        <ChatShell.Turn data-testid="orphan" />
      </>,
    );

    const settled = screen.getByTestId('settled').className;
    expect(settled).toContain('min-h-0');
    expect(settled).toContain('duration-[1500ms]');
    expect(settled).not.toContain('70cqh');

    const live = screen.getByTestId('live').className;
    expect(live).toContain('min-h-[70cqh]');
    expect(live).toContain('starting:min-h-0');
    expect(live).toContain('duration-[440ms]');
    expect(live).not.toContain('duration-[1500ms]');

    expect(screen.getByTestId('restored').className).toContain('transition-none');
    expect(screen.getByTestId('orphan').className).not.toContain('min-h');
  });
});
