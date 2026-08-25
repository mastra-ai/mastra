// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useReveal } from './use-reveal';

const frame = () => act(() => void vi.advanceTimersByTime(16));

const words = (text: string) => text.match(/\S+/g)?.length ?? 0;

const stream = (text: string, streaming = true) =>
  renderHook(props => useReveal(props.text, props.streaming), { initialProps: { text, streaming } });

function drain(until: () => boolean, limit = 600): number {
  let frames = 0;

  while (!until() && frames < limit) {
    frame();
    frames++;
  }

  return frames;
}

const sentence = 'the quick brown fox jumps over the lazy dog ';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('useReveal', () => {
  it('leaves a reply loaded from history where it is', () => {
    const { result } = stream('A reply loaded from history.', false);

    expect(result.current).toBe('A reply loaded from history.');
  });

  it('holds a streamed reply back before its first word', () => {
    const { result } = stream('Ten words is what a first chunk usually carries here.');

    expect(result.current).toBe('');

    drain(() => words(result.current) > 0);
    expect(result.current).toBe('Ten');
  });

  it('lands one word at a time, never two on a frame', () => {
    const { result, rerender } = stream('');
    let reply = '';
    let landed = 0;

    for (let chunk = 0; chunk < 20; chunk++) {
      reply += sentence;
      rerender({ text: reply, streaming: true });

      for (let frames = 0; frames < 6; frames++) {
        frame();
        const now = words(result.current);

        expect(now - landed).toBeLessThanOrEqual(1);
        landed = now;
      }
    }

    expect(landed).toBeGreaterThan(0);
  });

  it('holds a steady pace once the reply has found its rhythm', () => {
    const { result, rerender } = stream('');
    const gaps: number[] = [];
    let reply = '';
    let landed = 0;
    let previous = 0;

    for (let tick = 0; tick < 600; tick++) {
      if (tick % 8 === 0) {
        reply += 'three words here ';
        rerender({ text: reply, streaming: true });
      }

      frame();

      const now = words(result.current);
      if (now === landed) continue;

      if (tick > 300) gaps.push(tick - previous);
      landed = now;
      previous = tick;
    }

    expect(gaps.length).toBeGreaterThan(20);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(2);
  });

  it('goes on revealing between chunks instead of waiting for the next one', () => {
    const { result, rerender } = stream('One');
    rerender({ text: `One ${sentence.repeat(4)}`, streaming: true });

    const early = drain(() => words(result.current) > 3);
    const late = drain(() => words(result.current) > 6);

    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(0);
  });

  it('keeps moving while chunks land on every single frame', () => {
    const { result, rerender } = stream('');
    let reply = '';

    for (let chunk = 0; chunk < 60; chunk++) {
      reply += 'word ';
      rerender({ text: reply, streaming: true });
      frame();
    }

    expect(words(result.current)).toBeGreaterThan(5);
  });

  it('trails a reply that keeps growing without ever falling out of reach', () => {
    const { result, rerender } = stream('');
    let reply = '';

    for (let chunk = 0; chunk < 60; chunk++) {
      reply += 'three words here ';
      rerender({ text: reply, streaming: true });
      drain(() => false, 8);
    }

    expect(words(reply) - words(result.current)).toBeLessThan(100);

    rerender({ text: reply, streaming: false });
    expect(drain(() => result.current === reply)).toBeLessThan(250);
  });

  it('catches up on a reply it mounted late into rather than retyping it', () => {
    const reply = sentence.repeat(30);
    const { result } = stream(reply);

    const held = words(reply) - words(result.current);

    expect(held).toBeGreaterThan(0);
    expect(held).toBeLessThan(45);
  });

  it('finishes the last words after the reply stops streaming', () => {
    const reply = 'A reply that just ended, mid reveal.';
    const { result, rerender } = stream(reply);

    frame();
    expect(result.current).not.toBe(reply);

    rerender({ text: reply, streaming: false });
    drain(() => result.current === reply);

    expect(result.current).toBe(reply);
  });

  it('starts over when a settled reply is replaced by a new one', () => {
    const first = sentence.repeat(4);
    const { result, rerender } = stream(first);
    drain(() => result.current === first);

    rerender({ text: 'One two three', streaming: true });
    rerender({ text: `One two three ${sentence.repeat(2)}`, streaming: true });
    frame();

    expect(words(result.current)).toBeLessThan(6);
  });

  it('reveals everything at once for a reader who asked for less motion', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }),
    });

    const { result } = stream('The whole reply, at once.');

    expect(result.current).toBe('The whole reply, at once.');
  });

  it('runs no frame loop for a reply that is already whole', () => {
    const request = vi.spyOn(window, 'requestAnimationFrame');

    stream('A reply loaded from history.', false);

    expect(request).not.toHaveBeenCalled();
    request.mockRestore();
  });

  it('stops its frame loop when the reply goes away', () => {
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = stream(sentence.repeat(4));

    frame();
    expect(cancel).not.toHaveBeenCalled();

    unmount();
    expect(cancel).toHaveBeenCalled();
    cancel.mockRestore();
  });
});
