import type { Component } from '@earendil-works/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import { showModalOverlay } from '../overlay.js';

function createTui(rows = 40, columns = 120) {
  return {
    terminal: { rows, columns },
    showOverlay: vi.fn((_component: Component) => ({
      hide: vi.fn(),
      setHidden: vi.fn(),
      isHidden: vi.fn(() => false),
      focus: vi.fn(),
      unfocus: vi.fn(),
      isFocused: vi.fn(() => true),
    })),
  } as any;
}

describe('showModalOverlay', () => {
  it('pads short modal output to a minimum height', () => {
    const tui = createTui(40, 120);
    const component: Component = {
      render: () => ['hello'],
      invalidate: vi.fn(),
    };

    showModalOverlay(tui, component, { maxHeight: '80%' });

    const wrapped = tui.showOverlay.mock.calls[0][0] as Component;
    expect(wrapped.render(20)).toHaveLength(28);
  });

  it('does not truncate modal output taller than the minimum height', () => {
    const tui = createTui(40, 120);
    const component: Component = {
      render: () => Array.from({ length: 30 }, (_, i) => `line ${i}`),
      invalidate: vi.fn(),
    };

    showModalOverlay(tui, component, { maxHeight: '80%' });

    const wrapped = tui.showOverlay.mock.calls[0][0] as Component;
    const output = wrapped.render(20);
    expect(output.length).toBeGreaterThanOrEqual(30);
    expect(output.some(line => line.replace(/\x1b\[[0-9;]*m/g, '').includes('line 29'))).toBe(true);
  });

  it('caps minimum height to the configured max height', () => {
    const tui = createTui(40, 120);
    const component: Component = {
      render: () => ['hello'],
      invalidate: vi.fn(),
    };

    showModalOverlay(tui, component, { maxHeight: '50%' });

    const wrapped = tui.showOverlay.mock.calls[0][0] as Component;
    expect(wrapped.render(20)).toHaveLength(20);
  });

  it('adds capped top padding so sparse modal content is not pinned to the top', () => {
    const tui = createTui(40, 120);
    const component: Component = {
      render: () => ['hello'],
      invalidate: vi.fn(),
    };

    showModalOverlay(tui, component, { maxHeight: '80%' });

    const wrapped = tui.showOverlay.mock.calls[0][0] as Component;
    const output = wrapped.render(20);
    expect(output[0]).not.toContain('hello');
    expect(output.findIndex(line => line.includes('hello'))).toBeGreaterThanOrEqual(4);
  });

  it('opens in the prompt slot when the TUI has one, with its title', () => {
    const tui = createTui(40, 120);
    const open = vi.fn(() => ({}));
    tui.promptSlot = { open };
    tui.hasPopup = () => false;
    const component: Component = { render: () => ['hello'], invalidate: vi.fn() };

    showModalOverlay(tui, component, { title: 'Select thread' });

    expect(open).toHaveBeenCalledWith(component, { title: 'Select thread', hints: undefined });
    expect(tui.showOverlay).not.toHaveBeenCalled();
  });

  it('opens as a pop-up while a pop-up such as the full-screen setup is open', () => {
    const tui = createTui(40, 120);
    const open = vi.fn(() => ({}));
    tui.promptSlot = { open };
    tui.hasPopup = () => true;
    const component: Component = { render: () => ['hello'], invalidate: vi.fn() };

    showModalOverlay(tui, component, { title: 'Select model' });

    expect(open).not.toHaveBeenCalled();
    const wrapped = tui.showOverlay.mock.calls[0][0] as Component;
    expect(wrapped.render(60).join('\n')).toContain('select model');
  });

  it('shows full-screen views as they are, never in the slot', () => {
    const tui = createTui(40, 120);
    const open = vi.fn(() => ({}));
    tui.promptSlot = { open };
    tui.hasPopup = () => false;
    const component: Component = { render: () => ['hello'], invalidate: vi.fn() };

    showModalOverlay(tui, component, { fullscreen: true, minHeightPercent: 0 });

    expect(open).not.toHaveBeenCalled();
    const wrapped = tui.showOverlay.mock.calls[0][0] as Component;
    expect(wrapped.render(60)[0]).toBe('hello');
  });
});
