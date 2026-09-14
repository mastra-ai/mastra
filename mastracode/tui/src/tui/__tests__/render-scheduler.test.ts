import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_RENDER_COALESCE_MS,
  installRenderScheduler,
  RenderScheduler,
  flushRender,
  requestRender,
} from '../render-scheduler.js';

describe('RenderScheduler', () => {
  it('limits default background rendering to roughly seven frames per second', () => {
    expect(DEFAULT_RENDER_COALESCE_MS).toBe(150);
  });

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

  it('applies the latest pending state immediately before scheduled and flushed renders', () => {
    vi.useFakeTimers();
    try {
      const calls: string[] = [];
      const scheduler = new RenderScheduler(
        () => calls.push('render'),
        80,
        () => 0,
        () => calls.push('apply'),
      );

      scheduler.request();
      vi.advanceTimersByTime(80);
      expect(calls).toEqual(['apply', 'render']);

      scheduler.request();
      scheduler.flush();
      expect(calls).toEqual(['apply', 'render', 'apply', 'render']);
      scheduler.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not apply pending state after disposal', () => {
    vi.useFakeTimers();
    try {
      const apply = vi.fn();
      const scheduler = new RenderScheduler(vi.fn(), 80, () => 0, apply);
      scheduler.request();
      scheduler.dispose();
      scheduler.flush();
      vi.runAllTimers();
      expect(apply).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
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

  it('coalesces direct UI render requests through the installed scheduler', () => {
    vi.useFakeTimers();
    try {
      let now = 1_000;
      const render = vi.fn();
      const ui = { requestRender: render };
      const scheduler = installRenderScheduler(ui, undefined, 80, () => now);

      ui.requestRender();
      ui.requestRender();
      ui.requestRender();
      expect(render).not.toHaveBeenCalled();

      vi.advanceTimersByTime(0);
      expect(render).toHaveBeenCalledOnce();
      expect(render).toHaveBeenLastCalledWith(false);

      now += 10;
      ui.requestRender();
      ui.requestRender();
      vi.advanceTimersByTime(69);
      expect(render).toHaveBeenCalledOnce();

      now += 70;
      vi.advanceTimersByTime(1);
      expect(render).toHaveBeenCalledTimes(2);
      scheduler.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders once immediately for requests made while handling terminal input', async () => {
    const render = vi.fn();
    const removeInputListener = vi.fn();
    let inputListener: ((data: string) => { consume?: boolean; data?: string } | undefined) | undefined;
    const ui = {
      requestRender: render,
      addInputListener: vi.fn((listener: (data: string) => { consume?: boolean; data?: string } | undefined) => {
        inputListener = listener;
        return removeInputListener;
      }),
    };
    const scheduler = installRenderScheduler(ui, undefined, 80, () => 1_000);

    inputListener?.('a');
    ui.requestRender();
    ui.requestRender();

    expect(render).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledWith(false);

    await Promise.resolve();
    ui.requestRender();
    expect(render).toHaveBeenCalledOnce();
    scheduler.dispose();
    scheduler.dispose();
    expect(removeInputListener).toHaveBeenCalledOnce();

    ui.requestRender();
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('schedules one delayed follow-up when a render requests another render', async () => {
    vi.useFakeTimers();
    try {
      let now = 1_000;
      const ui = { requestRender: vi.fn() };
      const render = ui.requestRender;
      const scheduler = installRenderScheduler(ui, undefined, 80, () => now);
      render.mockImplementationOnce(() => ui.requestRender());

      ui.requestRender();
      vi.advanceTimersByTime(0);
      expect(render).toHaveBeenCalledOnce();

      await Promise.resolve();
      expect(render).toHaveBeenCalledOnce();

      now += 79;
      vi.advanceTimersByTime(79);
      expect(render).toHaveBeenCalledOnce();

      now += 1;
      vi.advanceTimersByTime(1);
      expect(render).toHaveBeenCalledTimes(2);
      scheduler.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('defers a forced request made during rendering instead of rendering recursively', async () => {
    vi.useFakeTimers();
    try {
      const ui = { requestRender: vi.fn() };
      const render = ui.requestRender;
      const scheduler = installRenderScheduler(ui, undefined, 80, () => 1_000);
      render.mockImplementationOnce(() => ui.requestRender(true));

      ui.requestRender();
      vi.advanceTimersByTime(0);
      expect(render).toHaveBeenCalledOnce();

      await Promise.resolve();
      expect(render).toHaveBeenCalledTimes(2);
      expect(render).toHaveBeenLastCalledWith(true);
      scheduler.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('preserves forced UI renders and cancels pending background work', () => {
    vi.useFakeTimers();
    try {
      const render = vi.fn();
      const apply = vi.fn();
      const ui = { requestRender: render };
      const scheduler = installRenderScheduler(ui, apply, 80, () => 1_000);

      ui.requestRender();
      ui.requestRender(true);

      expect(apply).toHaveBeenCalledOnce();
      expect(render).toHaveBeenCalledOnce();
      expect(render).toHaveBeenCalledWith(true);

      vi.runAllTimers();
      expect(render).toHaveBeenCalledOnce();
      scheduler.dispose();
    } finally {
      vi.useRealTimers();
    }
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
