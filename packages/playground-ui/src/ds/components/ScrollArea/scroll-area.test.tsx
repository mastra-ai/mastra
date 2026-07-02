// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ScrollArea } from './scroll-area';

afterEach(() => {
  cleanup();
});

const VIEWPORT_MARKER = 'test-viewport-marker';

const getViewport = () => {
  const viewport = document.querySelector<HTMLElement>(`.${VIEWPORT_MARKER}`);
  expect(viewport).not.toBeNull();
  if (!viewport) throw new Error('Expected scroll viewport');
  return viewport;
};
const getContent = (viewport: HTMLElement) => viewport.firstElementChild as HTMLElement;

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

    it('does not render scroll buttons for vertical-only scroll areas', () => {
      renderArea({ scrollButtons: true });

      expect(screen.queryByRole('button', { name: 'Scroll left' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Scroll right' })).toBeNull();
    });
  });
});
