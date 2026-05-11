// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ScrollArea } from './scroll-area';

afterEach(() => {
  cleanup();
});

const VIEWPORT_MARKER = 'test-viewport-marker';

const getViewport = () => document.querySelector<HTMLElement>(`.${VIEWPORT_MARKER}`)!;
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
});
