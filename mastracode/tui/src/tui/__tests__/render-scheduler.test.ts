import { describe, expect, it, vi } from 'vitest';

import { RenderScheduler, flushRender, requestRender } from '../render-scheduler.js';

describe('RenderScheduler', () => {
  it('coalesces bursty render requests into one delayed render inside the throttle window', () => {
    vi.useFakeTimers();
    let now = 1_000;
    const render = vi.fn();
    const scheduler = new RenderScheduler(render, 80, () => now);

    scheduler.request();
    scheduler.request();
    scheduler.request();
    expect(render).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(render).toHaveBeenCalledTimes(1);

    now += 10;
    scheduler.request();
    scheduler.request();
    scheduler.request();
    expect(render).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(69);
    expect(render).toHaveBeenCalledTimes(1);

    now += 70;
    vi.advanceTimersByTime(1);
    expect(render).toHaveBeenCalledTimes(2);

    scheduler.dispose();
    vi.useRealTimers();
  });

  it('flushes immediately and cancels a pending coalesced render', () => {
    vi.useFakeTimers();
    let now = 1_000;
    const render = vi.fn();
    const scheduler = new RenderScheduler(render, 80, () => now);

    scheduler.request();
    now += 10;
    scheduler.request();

    scheduler.flush();
    expect(render).toHaveBeenCalledTimes(1);

    now += 80;
    vi.advanceTimersByTime(80);
    expect(render).toHaveBeenCalledTimes(1);

    scheduler.dispose();
    vi.useRealTimers();
  });

  it('ignores requests and flushes after disposal', () => {
    vi.useFakeTimers();
    const render = vi.fn();
    const scheduler = new RenderScheduler(render);

    scheduler.request();
    scheduler.dispose();
    scheduler.request();
    scheduler.flush();
    vi.runAllTimers();

    expect(render).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('uses only the scheduler when one is present', () => {
    const legacyRender = vi.fn();
    const scheduler = { request: vi.fn(), flush: vi.fn() } as unknown as RenderScheduler;
    const state = { ui: { requestRender: legacyRender }, renderScheduler: scheduler };

    requestRender(state);
    flushRender(state);

    expect(scheduler.request).toHaveBeenCalledOnce();
    expect(scheduler.flush).toHaveBeenCalledOnce();
    expect(legacyRender).not.toHaveBeenCalled();
  });

  it('falls back to direct ui rendering when no scheduler is present', () => {
    const render = vi.fn();
    const state = { ui: { requestRender: render } };

    requestRender(state);
    flushRender(state);

    expect(render).toHaveBeenCalledTimes(2);
  });
});
