// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, assert, describe, expect, it, vi } from 'vitest';

import { ScrollArea } from './scroll-area';

afterEach(() => {
  cleanup();
});

const VIEWPORT_MARKER = 'test-viewport-marker';

const getViewport = () => {
  const viewport = document.querySelector<HTMLElement>(`.${VIEWPORT_MARKER}`);
  assert(viewport, 'Expected scroll viewport');
  return viewport;
};
const getContent = (viewport: HTMLElement) => viewport.firstElementChild as HTMLElement;

/** jsdom has no layout, so the viewport never really scrolls; watch the call instead. */
const stubScrollBy = () => {
  const scrollBy = vi.fn();
  Object.defineProperty(getViewport(), 'scrollBy', { configurable: true, value: scrollBy });
  return scrollBy;
};

const renderArea = (props: Partial<React.ComponentProps<typeof ScrollArea>> = {}) =>
  render(
    <ScrollArea viewPortClassName={VIEWPORT_MARKER} {...props}>
      <div>content</div>
    </ScrollArea>,
  );

describe('ScrollArea', () => {
  describe('orientation="vertical" (default)', () => {
    it('clips horizontal overflow on the viewport so wide children do not trigger x-scroll', () => {
      renderArea();
      const viewport = getViewport();
      expect(viewport.style.overflowX).toBe('hidden');
      expect(viewport.style.overflowY).toBe('scroll');
    });

    it('lets the content shrink below its intrinsic width by overriding base-ui min-width: fit-content', () => {
      renderArea();
      const content = getContent(getViewport());
      expect(content.style.minWidth).toBe('0px');
    });
  });

  describe('orientation="horizontal"', () => {
    it('clips vertical overflow on the viewport so tall children do not trigger y-scroll', () => {
      renderArea({ orientation: 'horizontal' });
      const viewport = getViewport();
      expect(viewport.style.overflowX).toBe('scroll');
      expect(viewport.style.overflowY).toBe('hidden');
    });

    it('lets the content shrink below its intrinsic height', () => {
      renderArea({ orientation: 'horizontal' });
      const content = getContent(getViewport());
      expect(content.style.minHeight).toBe('0px');
    });
  });

  describe('orientation="both"', () => {
    it('does not override viewport overflow so base-ui handles both axes', () => {
      renderArea({ orientation: 'both' });
      const viewport = getViewport();
      expect(viewport.style.overflowX).toBe('');
      expect(viewport.style.overflowY).toBe('');
    });

    it('keeps base-ui default content min-width: fit-content so the content can grow on both axes', () => {
      renderArea({ orientation: 'both' });
      const content = getContent(getViewport());
      expect(content.style.minWidth).toBe('fit-content');
      expect(content.style.minHeight).toBe('');
    });
  });

  describe('maxHeight', () => {
    it('applies maxHeight as inline style on the viewport', () => {
      renderArea({ maxHeight: '400px' });
      expect(getViewport().style.maxHeight).toBe('400px');
    });

    it('applies maxHeight alongside the orientation overflow overrides', () => {
      renderArea({ maxHeight: '400px', orientation: 'vertical' });
      const viewport = getViewport();
      expect(viewport.style.maxHeight).toBe('400px');
      expect(viewport.style.overflowX).toBe('hidden');
      expect(viewport.style.overflowY).toBe('scroll');
    });

    it('preserves maxHeight in orientation="both" without adding overflow overrides', () => {
      renderArea({ maxHeight: '400px', orientation: 'both' });
      const viewport = getViewport();
      expect(viewport.style.maxHeight).toBe('400px');
      expect(viewport.style.overflowX).toBe('');
      expect(viewport.style.overflowY).toBe('');
    });
  });

  describe('viewportRef', () => {
    it('hands the viewport to a callback ref', () => {
      const seen: Array<HTMLDivElement | null> = [];
      renderArea({
        viewportRef: node => {
          seen.push(node);
        },
      });

      expect(seen[0]).toBe(getViewport());
    });

    it('fills an object ref with the viewport', () => {
      const ref = React.createRef<HTMLDivElement>();
      renderArea({ viewportRef: ref });

      expect(ref.current).toBe(getViewport());
    });
  });

  describe('children rendering', () => {
    it('renders children inside the viewport content wrapper', () => {
      render(
        <ScrollArea viewPortClassName={VIEWPORT_MARKER}>
          <div data-testid="child">hello</div>
        </ScrollArea>,
      );
      const viewport = getViewport();
      expect(viewport.querySelector('[data-testid="child"]')?.textContent).toBe('hello');
    });

    it('keeps children inside the content wrapper even when content gets a min-width override', () => {
      render(
        <ScrollArea viewPortClassName={VIEWPORT_MARKER} orientation="vertical">
          <div data-testid="child">hello</div>
        </ScrollArea>,
      );
      const content = getContent(getViewport());
      expect(content.querySelector('[data-testid="child"]')?.textContent).toBe('hello');
    });
  });

  describe('scrollButtons', () => {
    it('uses Base UI overflow data attributes to control horizontal button visibility', () => {
      renderArea({ orientation: 'horizontal', scrollButtons: true });

      const leftButton = screen.getByRole('button', { name: 'Scroll left' });
      const rightButton = screen.getByRole('button', { name: 'Scroll right' });

      expect(leftButton.className).toContain('hidden');
      expect(leftButton.className).toContain('group-data-[overflow-x-start]/scroll-area:flex');
      expect(rightButton.className).toContain('hidden');
      expect(rightButton.className).toContain('group-data-[overflow-x-end]/scroll-area:flex');
    });

    it('scrolls the viewport with configured button speed', () => {
      renderArea({
        orientation: 'horizontal',
        scrollButtons: { scrollSpeed: 30, scrollIntervalTime: 50, rightLabel: 'Scroll tags right' },
      });
      const viewport = getViewport();
      const scrollBy = vi.fn();
      Object.defineProperty(viewport, 'scrollBy', { configurable: true, value: scrollBy });

      const button = screen.getByRole('button', { name: 'Scroll tags right' });
      fireEvent.pointerDown(button);
      fireEvent.pointerUp(button);

      expect(scrollBy).toHaveBeenCalledWith({ left: 60, behavior: 'smooth' });
    });

    it('clamps scroll button numeric options to safe positive values', () => {
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      renderArea({
        orientation: 'horizontal',
        scrollButtons: { scrollSpeed: -30, scrollIntervalTime: 0, rightLabel: 'Scroll tags right' },
      });
      const viewport = getViewport();
      const scrollBy = vi.fn();
      Object.defineProperty(viewport, 'scrollBy', { configurable: true, value: scrollBy });

      const button = screen.getByRole('button', { name: 'Scroll tags right' });
      fireEvent.pointerDown(button);
      fireEvent.pointerUp(button);

      expect(scrollBy).toHaveBeenCalledWith({ left: 2, behavior: 'smooth' });
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 16);
      setIntervalSpy.mockRestore();
    });

    it('scrolls the other way from the left button', () => {
      renderArea({ orientation: 'horizontal', scrollButtons: { scrollSpeed: 30 } });
      const scrollBy = stubScrollBy();

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Scroll left' }));
      fireEvent.pointerUp(screen.getByRole('button', { name: 'Scroll left' }));

      expect(scrollBy).toHaveBeenCalledWith({ left: -60, behavior: 'smooth' });
    });

    it('points each button the way it scrolls', () => {
      renderArea({ orientation: 'horizontal', scrollButtons: true });

      const left = screen.getByRole('button', { name: 'Scroll left' });
      const right = screen.getByRole('button', { name: 'Scroll right' });

      expect(left.querySelector('svg')?.classList.contains('lucide-chevron-left')).toBe(true);
      expect(right.querySelector('svg')?.classList.contains('lucide-chevron-right')).toBe(true);
    });

    it('keeps going while the button is held, at its ordinary speed', () => {
      vi.useFakeTimers();
      try {
        renderArea({
          orientation: 'horizontal',
          scrollButtons: { scrollSpeed: 30, scrollIntervalTime: 50 },
        });
        const scrollBy = stubScrollBy();
        const button = screen.getByRole('button', { name: 'Scroll right' });

        fireEvent.pointerDown(button);
        // The first nudge is a double step, so the press is felt straight away.
        expect(scrollBy).toHaveBeenCalledWith({ left: 60, behavior: 'smooth' });

        vi.advanceTimersByTime(50);
        expect(scrollBy).toHaveBeenLastCalledWith({ left: 30, behavior: 'smooth' });

        fireEvent.pointerUp(button);
        scrollBy.mockClear();
        vi.advanceTimersByTime(500);

        expect(scrollBy).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it.each(['pointerLeave', 'pointerCancel', 'blur'] as const)('stops scrolling on %s too', eventName => {
      vi.useFakeTimers();
      try {
        renderArea({ orientation: 'horizontal', scrollButtons: { scrollSpeed: 30, scrollIntervalTime: 50 } });
        const scrollBy = stubScrollBy();
        const button = screen.getByRole('button', { name: 'Scroll right' });

        fireEvent.pointerDown(button);
        fireEvent[eventName](button);
        scrollBy.mockClear();
        vi.advanceTimersByTime(500);

        expect(scrollBy).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('stops scrolling when the area goes away', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
      try {
        const { unmount } = renderArea({ orientation: 'horizontal', scrollButtons: true });
        stubScrollBy();

        fireEvent.pointerDown(screen.getByRole('button', { name: 'Scroll right' }));
        clearIntervalSpy.mockClear();

        unmount();

        expect(clearIntervalSpy).toHaveBeenCalled();
      } finally {
        clearIntervalSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it('scrolls a double step when the button is reached by keyboard', () => {
      renderArea({ orientation: 'horizontal', scrollButtons: { scrollSpeed: 30 } });
      const scrollBy = stubScrollBy();

      // `detail: 0` is how a browser reports a click that came from the keyboard.
      fireEvent.click(screen.getByRole('button', { name: 'Scroll right' }), { detail: 0 });

      expect(scrollBy).toHaveBeenCalledWith({ left: 60, behavior: 'smooth' });
    });

    it('scrolls the other way when the left button is reached by keyboard', () => {
      renderArea({ orientation: 'horizontal', scrollButtons: { scrollSpeed: 30 } });
      const scrollBy = stubScrollBy();

      fireEvent.click(screen.getByRole('button', { name: 'Scroll left' }), { detail: 0 });

      expect(scrollBy).toHaveBeenCalledWith({ left: -60, behavior: 'smooth' });
    });

    it('runs one repeat at a time, however often it is pressed', () => {
      vi.useFakeTimers();
      try {
        renderArea({ orientation: 'horizontal', scrollButtons: { scrollSpeed: 30, scrollIntervalTime: 50 } });
        const scrollBy = stubScrollBy();
        const button = screen.getByRole('button', { name: 'Scroll right' });

        fireEvent.pointerDown(button);
        fireEvent.pointerDown(button);
        fireEvent.pointerUp(button);
        scrollBy.mockClear();
        vi.advanceTimersByTime(500);

        expect(scrollBy).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it('leaves a pointer click to the press handlers', () => {
      renderArea({ orientation: 'horizontal', scrollButtons: { scrollSpeed: 30 } });
      const scrollBy = stubScrollBy();

      fireEvent.click(screen.getByRole('button', { name: 'Scroll right' }), { detail: 1 });

      expect(scrollBy).not.toHaveBeenCalled();
    });

    it('falls back to the ordinary speed when the caller asks for one it cannot use', () => {
      renderArea({ orientation: 'horizontal', scrollButtons: { scrollSpeed: Number.NaN } });
      const scrollBy = stubScrollBy();

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Scroll right' }));
      fireEvent.pointerUp(screen.getByRole('button', { name: 'Scroll right' }));

      expect(scrollBy).toHaveBeenCalledWith({ left: 200, behavior: 'smooth' });
    });

    it('does not render scroll buttons for vertical-only scroll areas', () => {
      renderArea({ scrollButtons: true });

      expect(screen.queryByRole('button', { name: 'Scroll left' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Scroll right' })).toBeNull();
    });
  });
});

describe('ScrollArea — fade masks', () => {
  const maskSides = (props: Partial<React.ComponentProps<typeof ScrollArea>> = {}) => {
    renderArea(props);
    const className = getViewport().className;
    return {
      top: className.includes('data-[overflow-y-start]:mask-t-from'),
      bottom: className.includes('data-[overflow-y-end]:mask-b-from'),
      left: className.includes('data-[overflow-x-start]:mask-l-from'),
      right: className.includes('data-[overflow-x-end]:mask-r-from'),
    };
  };

  it('fades both ends of the axis it scrolls', () => {
    expect(maskSides()).toEqual({ top: true, bottom: true, left: false, right: false });

    cleanup();

    expect(maskSides({ orientation: 'horizontal' })).toEqual({
      top: false,
      bottom: false,
      left: true,
      right: true,
    });
  });

  it('fades all four ends when it scrolls both ways', () => {
    expect(maskSides({ orientation: 'both' })).toEqual({ top: true, bottom: true, left: true, right: true });
  });

  it('fades nothing when the caller turns masking off', () => {
    expect(maskSides({ orientation: 'both', mask: false })).toEqual({
      top: false,
      bottom: false,
      left: false,
      right: false,
    });
  });

  it('fades the axis ends when the caller turns masking on explicitly', () => {
    expect(maskSides({ mask: true })).toEqual({ top: true, bottom: true, left: false, right: false });
  });

  it('turns off a whole axis at once', () => {
    expect(maskSides({ orientation: 'both', mask: { y: false } })).toEqual({
      top: false,
      bottom: false,
      left: true,
      right: true,
    });

    cleanup();

    expect(maskSides({ orientation: 'both', mask: { x: false } })).toEqual({
      top: true,
      bottom: true,
      left: false,
      right: false,
    });
  });

  it('turns on an axis the orientation does not scroll', () => {
    expect(maskSides({ orientation: 'vertical', mask: { x: true } })).toEqual({
      top: true,
      bottom: true,
      left: true,
      right: true,
    });
  });

  it.each([
    ['top', { top: false }, { top: false, bottom: true, left: true, right: true }],
    ['bottom', { bottom: false }, { top: true, bottom: false, left: true, right: true }],
    ['left', { left: false }, { top: true, bottom: true, left: false, right: true }],
    ['right', { right: false }, { top: true, bottom: true, left: true, right: false }],
  ])('turns off the %s end on its own', (_, mask, expected) => {
    expect(maskSides({ orientation: 'both', mask })).toEqual(expected);
  });

  it('still answers to the older showMask prop', () => {
    expect(maskSides({ showMask: false })).toEqual({ top: false, bottom: false, left: false, right: false });
  });

  it('lets a single end override the axis it belongs to', () => {
    expect(maskSides({ orientation: 'both', mask: { y: false, top: true } })).toEqual({
      top: true,
      bottom: false,
      left: true,
      right: true,
    });

    cleanup();

    expect(maskSides({ orientation: 'both', mask: { x: false, right: true } })).toEqual({
      top: true,
      bottom: true,
      left: false,
      right: true,
    });
  });
});
