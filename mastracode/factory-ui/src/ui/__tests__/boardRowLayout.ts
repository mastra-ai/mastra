import { screen } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Gives jsdom, which lays nothing out, the boxes a board's virtual window measures: a 600px scroll
 * viewport over 48px rows. `vi.restoreAllMocks()` takes them back.
 */
export function mockBoardRowLayout() {
  const height = function (this: Element) {
    return this.matches('.overflow-auto') ? 600 : 48;
  };
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(height);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1200);
  // TanStack Virtual sizes the scroll viewport from its client box.
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(height);
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(1200);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const scroller = this.closest<HTMLElement>('.overflow-auto');
    const height = this.matches('.overflow-auto') ? 600 : 48;
    return new DOMRect(0, this === scroller ? 0 : -(scroller?.scrollTop ?? 0), 1200, height);
  });
}

/** The element the board scrolls in. */
export function boardViewport() {
  const element = screen.getByTestId('board-column-triage').closest<HTMLElement>('.overflow-auto');
  if (!element) throw new Error('Missing board scroll container');
  return element;
}
