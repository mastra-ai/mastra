// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSmoothText } from './use-smooth-text';

const FRAME_MS = 16;

const frame = () => act(() => void vi.advanceTimersByTime(FRAME_MS));

function drain(shown: () => string, target: string, limit = 500): number {
  let frames = 0;

  while (shown() !== target && frames < limit) {
    frame();
    frames++;
  }

  return frames;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('useSmoothText', () => {
  it('shows a reply that was already on screen at mount', () => {
    const { result } = renderHook(() => useSmoothText('A reply loaded from history.'));

    expect(result.current).toBe('A reply loaded from history.');
  });

  it('spreads a chunk over several frames and lands all of it', () => {
    const reply = 'x'.repeat(200);
    const { result, rerender } = renderHook(text => useSmoothText(text), { initialProps: '' });

    rerender(reply);

    frame();
    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current.length).toBeLessThan(reply.length);

    expect(drain(() => result.current, reply)).toBeLessThan(120);
  });

  it('keeps up with chunks that keep arriving', () => {
    const { result, rerender } = renderHook(text => useSmoothText(text), { initialProps: '' });
    let reply = '';

    for (let chunk = 0; chunk < 40; chunk++) {
      reply += 'word '.repeat(3);
      rerender(reply);
      frame();
    }

    expect(reply.length - result.current.length).toBeLessThan(reply.length / 2);
    expect(drain(() => result.current, reply)).toBeLessThan(120);
  });

  it('starts over when the text is replaced by a shorter one', () => {
    const { result, rerender } = renderHook(text => useSmoothText(text), { initialProps: 'A long first reply.' });

    rerender('Hi');
    expect(result.current).toBe('Hi');

    rerender('Hi there, a second reply.');
    frame();

    expect(result.current.length).toBeLessThan(6);
  });

  it('reveals everything at once for a reader who asked for less motion', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }),
    });

    const { result, rerender } = renderHook(text => useSmoothText(text), { initialProps: '' });

    rerender('The whole reply, at once.');

    expect(result.current).toBe('The whole reply, at once.');
  });
});
