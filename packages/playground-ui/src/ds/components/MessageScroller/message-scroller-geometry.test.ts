// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getContentPadding,
  getCurrentAnchorId,
  getFollowTarget,
  getRelativeTop,
  getScrollTarget,
} from './message-scroller-geometry';
import type { MessageScrollerItemRecord } from './message-scroller-geometry';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const rectAt = (top: number, height: number) =>
  ({
    top,
    bottom: top + height,
    left: 0,
    right: 100,
    width: 100,
    height,
    x: 0,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

/** A viewport whose own box sits at `viewportTop` and is `clientHeight` tall. */
function makeViewport({
  viewportTop = 0,
  clientHeight = 500,
  scrollTop = 0,
}: { viewportTop?: number; clientHeight?: number; scrollTop?: number } = {}) {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => rectAt(viewportTop, clientHeight);
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight });
  element.scrollTop = scrollTop;
  return element;
}

/** A message box inside a content element carrying the given block padding. */
function makeItem({
  top,
  height = 100,
  paddingStart = 0,
  paddingEnd = 0,
}: {
  top: number;
  height?: number;
  paddingStart?: number;
  paddingEnd?: number;
}) {
  const content = document.createElement('div');
  content.style.paddingBlockStart = `${paddingStart}px`;
  content.style.paddingBlockEnd = `${paddingEnd}px`;
  const element = document.createElement('div');
  element.getBoundingClientRect = () => rectAt(top, height);
  content.appendChild(element);
  document.body.appendChild(content);
  return element;
}

describe('getContentPadding', () => {
  it('reads no padding without an element to read', () => {
    expect(getContentPadding(null)).toEqual({ start: 0, end: 0 });
  });

  it('reads the block padding', () => {
    const element = document.createElement('div');
    element.style.paddingBlockStart = '24px';
    element.style.paddingBlockEnd = '16px';
    document.body.appendChild(element);

    expect(getContentPadding(element)).toEqual({ start: 24, end: 16 });
  });

  it('falls back to the physical padding when there is no block padding', () => {
    const element = document.createElement('div');
    element.style.paddingTop = '12px';
    element.style.paddingBottom = '8px';
    document.body.appendChild(element);

    expect(getContentPadding(element)).toEqual({ start: 12, end: 8 });
  });

  it('reads an unset or unreadable padding as none', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      paddingBlockStart: 'auto',
      paddingBlockEnd: '',
      paddingTop: '',
      paddingBottom: '',
    } as unknown as CSSStyleDeclaration);

    expect(getContentPadding(element)).toEqual({ start: 0, end: 0 });
  });
});

describe('getRelativeTop', () => {
  it('measures the message against the viewport, from the top of the scroll', () => {
    const viewport = makeViewport({ viewportTop: 50, scrollTop: 200 });
    const element = document.createElement('div');
    element.getBoundingClientRect = () => rectAt(130, 40);

    // 130 - 50 puts it 80px into the viewport, and the viewport is 200px down.
    expect(getRelativeTop(element, viewport)).toBe(280);
  });

  it('measures a message scrolled above the viewport as a smaller offset', () => {
    const viewport = makeViewport({ viewportTop: 100, scrollTop: 500 });
    const element = document.createElement('div');
    element.getBoundingClientRect = () => rectAt(-40, 40);

    expect(getRelativeTop(element, viewport)).toBe(360);
  });
});

describe('getScrollTarget', () => {
  const target = (
    align: 'start' | 'center' | 'end' | 'nearest',
    item: HTMLElement,
    viewport: HTMLElement,
    scrollMargin = 0,
  ) =>
    getScrollTarget({
      align,
      contentElement: item.parentElement,
      element: item,
      scrollMargin,
      viewportElement: viewport,
    });

  it('puts the message at the top of the readable area by default', () => {
    const viewport = makeViewport({ clientHeight: 500 });
    const item = makeItem({ top: 300, paddingStart: 20 });

    expect(target('start', item, viewport)).toBe(280);
  });

  it('leaves room above the message when asked to', () => {
    const viewport = makeViewport({ clientHeight: 500 });
    const item = makeItem({ top: 300, paddingStart: 20 });

    expect(target('start', item, viewport, 16)).toBe(264);
  });

  it('reads the frame from the content element, however deep the message nests', () => {
    const viewport = makeViewport({ clientHeight: 500 });
    const item = makeItem({ top: 300, paddingStart: 20 });
    const content = item.parentElement;
    const group = document.createElement('div');
    content?.appendChild(group);
    group.appendChild(item);

    expect(
      getScrollTarget({
        align: 'start',
        contentElement: content,
        element: item,
        scrollMargin: 0,
        viewportElement: viewport,
      }),
    ).toBe(280);
  });

  it('centres the message in the readable area', () => {
    const viewport = makeViewport({ clientHeight: 500 });
    const item = makeItem({ top: 300, height: 100, paddingStart: 20, paddingEnd: 30 });

    // Readable area is 450 tall; a 100-tall message leaves 175 above it.
    expect(target('center', item, viewport)).toBe(300 - 20 - 175);
  });

  it('lifts a centred message further to leave room above it', () => {
    const viewport = makeViewport({ clientHeight: 500 });
    const item = makeItem({ top: 300, height: 100, paddingStart: 20, paddingEnd: 30 });

    expect(target('center', item, viewport, 16)).toBe(300 - 20 - 175 - 16);
  });

  it('never centres against a negative readable area', () => {
    const viewport = makeViewport({ clientHeight: 10 });
    const item = makeItem({ top: 300, height: 100, paddingStart: 40, paddingEnd: 40 });

    // The padding alone overflows the viewport; the readable area floors at zero.
    expect(target('center', item, viewport)).toBe(300 - 40 - (0 - 100) / 2);
  });

  it('puts the end of the message at the bottom of the viewport', () => {
    const viewport = makeViewport({ clientHeight: 500 });
    const item = makeItem({ top: 900, height: 100, paddingEnd: 30 });

    expect(target('end', item, viewport)).toBe(900 - 500 + 100 + 30);
  });

  it('leaves room below the message when asked to', () => {
    const viewport = makeViewport({ clientHeight: 500 });
    const item = makeItem({ top: 900, height: 100, paddingEnd: 30 });

    expect(target('end', item, viewport, 16)).toBe(900 - 500 + 100 + 30 + 16);
  });

  describe('nearest', () => {
    it('stays put when the message is already fully in view', () => {
      const viewport = makeViewport({ clientHeight: 500, scrollTop: 100 });
      const item = makeItem({ top: 200, height: 100 });

      expect(target('nearest', item, viewport)).toBe(100);
    });

    it('scrolls up to a message above the readable area', () => {
      // Scrolled 400 down, with the message starting 100px above the viewport.
      const viewport = makeViewport({ clientHeight: 500, scrollTop: 400 });
      const item = makeItem({ top: -100, height: 100, paddingStart: 20 });

      expect(target('nearest', item, viewport, 8)).toBe(300 - 20 - 8);
    });

    it('scrolls down to a message below the readable area', () => {
      const viewport = makeViewport({ clientHeight: 500, scrollTop: 0 });
      const item = makeItem({ top: 900, height: 100, paddingEnd: 30 });

      expect(target('nearest', item, viewport, 8)).toBe(1000 - 500 + 30 + 8);
    });

    it('counts a message resting exactly on the top edge as in view', () => {
      // The message starts level with the viewport's own top: scrolled 100
      // down, its box sits at 0 and the readable area starts 20 lower.
      const viewport = makeViewport({ clientHeight: 500, scrollTop: 100 });
      const item = makeItem({ top: 20, height: 100, paddingStart: 20 });

      expect(target('nearest', item, viewport, 8)).toBe(100);
    });

    it('scrolls to a message that starts on the top edge but runs past the bottom', () => {
      const viewport = makeViewport({ clientHeight: 500, scrollTop: 100 });
      const item = makeItem({ top: 20, height: 900, paddingStart: 20 });

      // Too tall to fit, so its end is brought to the bottom instead.
      expect(target('nearest', item, viewport, 8)).toBe(120 + 900 - 500 + 8);
    });

    it('counts a message resting exactly on the bottom edge as in view', () => {
      // Its end lands exactly on the bottom of the readable area: 100 + 500 - 30.
      const viewport = makeViewport({ clientHeight: 500, scrollTop: 100 });
      const item = makeItem({ top: 370, height: 100, paddingEnd: 30 });

      expect(target('nearest', item, viewport, 8)).toBe(100);
    });

    it('scrolls to a message tucked under the padding at the top', () => {
      // It is on screen, but the content padding covers where it starts.
      const viewport = makeViewport({ clientHeight: 500, scrollTop: 100 });
      const item = makeItem({ top: 0, height: 100, paddingStart: 20 });

      expect(target('nearest', item, viewport, 8)).toBe(100 - 20 - 8);
    });

    it('scrolls to a message running under the padding at the bottom', () => {
      const viewport = makeViewport({ clientHeight: 500, scrollTop: 100 });
      const item = makeItem({ top: 400, height: 100, paddingEnd: 30 });

      expect(target('nearest', item, viewport, 8)).toBe(600 - 500 + 30 + 8);
    });
  });
});

describe('getCurrentAnchorId', () => {
  const makeAnchor = (top: number, scrollAnchor = true): MessageScrollerItemRecord => {
    const element = document.createElement('div');
    element.getBoundingClientRect = () => rectAt(top, 40);
    return { element, scrollAnchor };
  };

  const anchorIdFor = ({
    items,
    visibleMessageIds = new Set<string>(),
    fallbackAnchorId = undefined as string | undefined,
    scrollMargin = 0,
    scrollPreviousItemPeek = 0,
    viewportTop = 0,
  }: {
    items: Array<readonly [string, MessageScrollerItemRecord]>;
    visibleMessageIds?: Set<string>;
    fallbackAnchorId?: string | undefined;
    scrollMargin?: number;
    scrollPreviousItemPeek?: number;
    viewportTop?: number;
  }) =>
    getCurrentAnchorId({
      fallbackAnchorId,
      items,
      scrollMargin,
      scrollPreviousItemPeek,
      visibleMessageIds,
      viewportElement: makeViewport({ viewportTop }),
    });

  it('takes the last anchor that has passed the anchor line', () => {
    const anchorId = anchorIdFor({
      items: [
        ['first', makeAnchor(-200)],
        ['second', makeAnchor(-50)],
        ['third', makeAnchor(300)],
      ],
    });

    expect(anchorId).toBe('second');
  });

  it('counts an anchor resting exactly on the line as passed', () => {
    expect(anchorIdFor({ items: [['first', makeAnchor(0)]] })).toBe('first');
  });

  it('allows a sub-pixel overshoot past the line', () => {
    expect(anchorIdFor({ items: [['first', makeAnchor(0.4)]] })).toBe('first');
    // Half a pixel over is still on the line; more than that is not.
    expect(anchorIdFor({ items: [['first', makeAnchor(0.5)]] })).toBe('first');
    expect(anchorIdFor({ items: [['first', makeAnchor(0.6)]] })).toBeUndefined();
  });

  it('moves the line down by the margin and the peek', () => {
    const items = [['first', makeAnchor(60)]] as Array<readonly [string, MessageScrollerItemRecord]>;

    expect(anchorIdFor({ items })).toBeUndefined();
    expect(anchorIdFor({ items, scrollMargin: 40, scrollPreviousItemPeek: 20 })).toBe('first');
  });

  it('measures the line from the viewport, not the window', () => {
    const items = [['first', makeAnchor(60)]] as Array<readonly [string, MessageScrollerItemRecord]>;

    expect(anchorIdFor({ items, viewportTop: 100 })).toBe('first');
  });

  it('ignores a message that is not an anchor', () => {
    const anchorId = anchorIdFor({
      items: [
        ['plain', makeAnchor(-100, false)],
        ['anchored', makeAnchor(-50)],
      ],
    });

    expect(anchorId).toBe('anchored');
  });

  it('falls to the first anchor still on screen when none has passed the line', () => {
    const anchorId = anchorIdFor({
      items: [
        ['above-but-plain', makeAnchor(-100, false)],
        ['first-visible', makeAnchor(300)],
        ['second-visible', makeAnchor(500)],
      ],
      visibleMessageIds: new Set(['first-visible', 'second-visible']),
    });

    expect(anchorId).toBe('first-visible');
  });

  it('keeps the anchor it had when nothing qualifies', () => {
    const anchorId = anchorIdFor({
      items: [['off-screen', makeAnchor(900)]],
      fallbackAnchorId: 'previous',
    });

    expect(anchorId).toBe('previous');
  });

  it('has no anchor at all with nothing to anchor to', () => {
    expect(anchorIdFor({ items: [] })).toBeUndefined();
  });
});

describe('getFollowTarget', () => {
  /** A scroll box holding one content element, with `dock` px of anything below it. */
  function makeScroll({
    clientHeight = 500,
    scrollTop = 0,
    contentHeight = 900,
    dock = 100,
    rowTop,
    rowHeight = 100,
  }: {
    clientHeight?: number;
    scrollTop?: number;
    contentHeight?: number;
    dock?: number;
    rowTop: number;
    rowHeight?: number;
  }) {
    const viewportElement = makeViewport({ clientHeight, scrollTop });
    Object.defineProperty(viewportElement, 'scrollHeight', { configurable: true, value: contentHeight + dock });
    const contentElement = document.createElement('div');
    contentElement.getBoundingClientRect = () => rectAt(-scrollTop, contentHeight);
    const row = document.createElement('div');
    row.getBoundingClientRect = () => rectAt(rowTop, rowHeight);
    contentElement.appendChild(row);
    document.body.appendChild(contentElement);

    const items: Array<readonly [string, MessageScrollerItemRecord]> = [['row', { element: row, scrollAnchor: true }]];
    return { contentElement, items, viewportElement };
  }

  it('rests the last row against the end of the view, above whatever is docked under it', () => {
    // Row bottom sits 800 down the content; 500 of view, 100 of dock below it.
    expect(getFollowTarget(makeScroll({ rowTop: 700, rowHeight: 100 }))).toBe(400);
  });

  it('ignores the room a live turn reserves under its last row', () => {
    const withRoom = makeScroll({ rowTop: 100, rowHeight: 100, contentHeight: 900 });
    // The box runs 500 further than the reply does: going there empties the view.
    expect(getFollowTarget(withRoom)).toBe(0);
  });

  it('falls back to the end of the box while there are no rows to rest on', () => {
    const { contentElement, viewportElement } = makeScroll({ rowTop: 0 });

    expect(getFollowTarget({ contentElement, items: [], viewportElement })).toBe(500);
  });
});
