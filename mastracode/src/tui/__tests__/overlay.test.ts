import type { Component } from '@mariozechner/pi-tui';
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
    expect(wrapped.render(20)).toHaveLength(30);
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
    expect(output[4]).toContain('hello');
  });
});
