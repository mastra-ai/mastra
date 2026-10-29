// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentIndicator } from './agent-indicator';
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

describe('AgentIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
    expect(drawnStrokes(container)).toHaveLength(62);
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

  it('stops animating once unmounted', () => {
    const { unmount } = render(<AgentIndicator state="thinking" />);
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
