// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startTrip } from './message-scroller-trip';
import type { TripEndReason } from './message-scroller-trip';

let now = 0;
let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;

const runFrames = (times: number[]) => {
  for (const time of times) {
    now = time;
    const pending = Array.from(frames.values());
    frames.clear();
    pending.forEach(callback => callback(now));
  }
};

beforeEach(() => {
  now = 0;
  frames = new Map();
  nextFrameId = 1;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    frames.delete(id);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const makeViewport = ({ scrollTop = 0, maxScrollTop }: { scrollTop?: number; maxScrollTop?: number } = {}) => {
  const element = document.createElement('div');
  let position = scrollTop;
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => position,
    set: (value: number) => {
      position = maxScrollTop === undefined ? value : Math.min(value, maxScrollTop);
    },
  });
  return element;
};

describe('startTrip', () => {
  it('carries the viewport to its destination and reports arrival', () => {
    const viewport = makeViewport();
    const onEnd = vi.fn<(reason: TripEndReason) => void>();

    startTrip(viewport, () => 1000, onEnd);
    runFrames([100, 300, 560]);

    expect(viewport.scrollTop).toBe(1000);
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('arrived');
  });

  it('moves through the curve, never past the destination', () => {
    const viewport = makeViewport();
    const samples: number[] = [];

    startTrip(
      viewport,
      () => 1000,
      () => {},
    );
    for (const time of [100, 200, 300, 400, 560]) {
      runFrames([time]);
      samples.push(viewport.scrollTop);
    }

    const sorted = samples.toSorted((left, right) => left - right);
    expect(samples).toEqual(sorted);
    expect(samples.every(position => position <= 1000)).toBe(true);
    expect(samples.at(-1)).toBe(1000);
  });

  it('bends toward a destination that moves while the layout settles', () => {
    const viewport = makeViewport();
    const onEnd = vi.fn<(reason: TripEndReason) => void>();
    let target = 500;

    startTrip(viewport, () => target, onEnd);
    runFrames([100]);
    target = 900;
    runFrames([300, 560]);

    expect(viewport.scrollTop).toBe(900);
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('arrived');
  });

  it('lets a reader who moved the viewport keep it', () => {
    const viewport = makeViewport();
    const onEnd = vi.fn<(reason: TripEndReason) => void>();

    startTrip(viewport, () => 1000, onEnd);
    runFrames([100]);
    viewport.scrollTop = 42;
    runFrames([200]);

    expect(viewport.scrollTop).toBe(42);
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('interrupted');
  });

  it('gives up on a destination the layout never releases', () => {
    const viewport = makeViewport({ maxScrollTop: 300 });
    const onEnd = vi.fn<(reason: TripEndReason) => void>();

    startTrip(viewport, () => 1000, onEnd);
    runFrames([200, 560, 700, 900]);

    expect(viewport.scrollTop).toBe(300);
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('expired');
  });

  it('ends quietly when the destination is gone', () => {
    const viewport = makeViewport();
    const onEnd = vi.fn<(reason: TripEndReason) => void>();

    startTrip(viewport, () => undefined, onEnd);
    runFrames([100]);

    expect(onEnd).toHaveBeenCalledExactlyOnceWith('expired');
  });

  it('stops without a word when cancelled', () => {
    const viewport = makeViewport();
    const onEnd = vi.fn<(reason: TripEndReason) => void>();

    const trip = startTrip(viewport, () => 1000, onEnd);
    runFrames([100]);
    const positionAtCancel = viewport.scrollTop;
    trip.cancel();
    runFrames([300, 560]);

    expect(viewport.scrollTop).toBe(positionAtCancel);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('jumps straight to the destination when motion is reduced', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    const viewport = makeViewport();
    const onEnd = vi.fn<(reason: TripEndReason) => void>();

    startTrip(viewport, () => 1000, onEnd);
    runFrames([16]);

    expect(viewport.scrollTop).toBe(1000);
    expect(onEnd).toHaveBeenCalledExactlyOnceWith('arrived');
    vi.unstubAllGlobals();
  });
});
