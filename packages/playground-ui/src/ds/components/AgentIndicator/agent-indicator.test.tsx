// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentIndicator } from './agent-indicator';
import { frameParts } from './paint';
import { agentIndicatorStates, poses } from './poses';
import { FRAME } from './shapes';

const firstStroke = (container: HTMLElement) => {
  const d = container.querySelector('[data-part="trail-ink"]')?.getAttribute('d') ?? '';
  const [x, y] = d.slice(1, d.indexOf('L')).split(' ').map(Number);
  return { x, y };
};

const drawnStrokes = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-part="trail-ink"]')].filter(p => Number(p.getAttribute('stroke-width')) > 0);

const preferReducedMotion = () =>
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }),
  });

const watchViewport = () => {
  const watchers: [IntersectionObserverCallback, IntersectionObserver, Element[]][] = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class Watcher implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds: ReadonlyArray<number> = [];
      readonly targets: Element[] = [];

      constructor(callback: IntersectionObserverCallback) {
        watchers.push([callback, this, this.targets]);
      }

      observe = (target: Element) => {
        this.targets.push(target);
      };
      unobserve = () => {};
      disconnect = () => {};
      takeRecords = (): IntersectionObserverEntry[] => [];
    },
  );
  return (isIntersecting: boolean) => {
    for (const [callback, observer, targets] of watchers) {
      const entries = targets.map(
        (target): IntersectionObserverEntry => ({
          target,
          isIntersecting,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          intersectionRatio: isIntersecting ? 1 : 0,
          rootBounds: null,
          time: performance.now(),
        }),
      );
      callback(entries, observer);
    }
  };
};

describe('AgentIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('gives every state a frame of the same shape, so any two can morph', () => {
    for (const state of agentIndicatorStates) {
      for (const t of [0, 0.3, 1.7, 2.6, 4.1, 9.3]) {
        const frame = poses[state](t, t / 2);
        expect(frame, state).toHaveLength(FRAME);
        expect(frame.every(Number.isFinite), state).toBe(true);
      }
    }
  });

  it('draws its state on the first paint', () => {
    const { container } = render(<AgentIndicator state="done" />);
    const doneStrokes = frameParts(poses.done(0, 0)).trailInks.filter(s => Number(s.width) > 0);
    expect(doneStrokes.length).toBeGreaterThan(0);
    expect(drawnStrokes(container)).toHaveLength(doneStrokes.length);
  });

  it('eases from one state into the next', () => {
    const { container, rerender } = render(<AgentIndicator state="done" />);
    expect(firstStroke(container).y).toBeCloseTo(0.48);

    rerender(<AgentIndicator state="error" />);
    vi.advanceTimersByTime(260);
    const midway = firstStroke(container).y;
    expect(midway).toBeLessThan(0.4);
    expect(midway).toBeGreaterThan(-5.4);

    vi.advanceTimersByTime(300);
    expect(firstStroke(container).y).toBeCloseTo(-5.52);
  });

  it('switches without motion when the user prefers reduced motion', () => {
    preferReducedMotion();
    const { container, rerender } = render(<AgentIndicator state="done" />);
    rerender(<AgentIndicator state="error" />);

    expect(firstStroke(container)).toEqual({ x: -5.52, y: -5.52 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops redrawing once its state comes to rest, and wakes for the next one', () => {
    const { rerender } = render(<AgentIndicator state="done" />);
    vi.advanceTimersByTime(3000);
    expect(vi.getTimerCount()).toBe(0);

    rerender(<AgentIndicator state="thinking" />);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('pauses while scrolled out of view', () => {
    const scrollIntoView = watchViewport();
    render(<AgentIndicator state="thinking" />);

    scrollIntoView(false);
    expect(vi.getTimerCount()).toBe(0);

    scrollIntoView(true);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('writes nothing while the drawing holds still', () => {
    const { container } = render(<AgentIndicator state="tool" />);
    vi.advanceTimersByTime(1100);
    const writes: MutationRecord[] = [];
    const observer = new MutationObserver(records => writes.push(...records));
    observer.observe(container, { attributes: true, subtree: true });

    vi.advanceTimersByTime(300);
    writes.push(...observer.takeRecords());
    observer.disconnect();
    expect(writes).toHaveLength(0);
  });

  it('stops animating once unmounted', () => {
    const { unmount } = render(<AgentIndicator state="thinking" />);
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
