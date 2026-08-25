// @vitest-environment jsdom
import { renderHook, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { useKeydown, useTableKeydown } from './use-keydown';

const pressKey = (key: string, modifiers: Partial<KeyboardEventInit> = {}) => {
  fireEvent.keyDown(window, { key, ...modifiers });
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useKeydown', () => {
  it('fires the handler when a single key is pressed', () => {
    const onArrowUp = vi.fn();
    renderHook(() => useKeydown({ ArrowUp: onArrowUp }));

    pressKey('ArrowUp');

    expect(onArrowUp).toHaveBeenCalledTimes(1);
  });

  it('does not fire the handler for a different key', () => {
    const onArrowUp = vi.fn();
    renderHook(() => useKeydown({ ArrowUp: onArrowUp }));

    pressKey('ArrowDown');

    expect(onArrowUp).not.toHaveBeenCalled();
  });

  it('matches the main key case-insensitively', () => {
    const onK = vi.fn();
    renderHook(() => useKeydown({ k: onK }));

    pressKey('K');

    expect(onK).toHaveBeenCalledTimes(1);
  });

  it('fires the handler when a modifier combo is pressed', () => {
    const onCmdK = vi.fn();
    renderHook(() => useKeydown({ 'cmd+k': onCmdK }));

    pressKey('k', { metaKey: true });

    expect(onCmdK).toHaveBeenCalledTimes(1);
  });

  it('supports multiple modifiers in a combo', () => {
    const onCtrlShiftP = vi.fn();
    renderHook(() => useKeydown({ 'ctrl+shift+p': onCtrlShiftP }));

    pressKey('p', { ctrlKey: true, shiftKey: true });

    expect(onCtrlShiftP).toHaveBeenCalledTimes(1);
  });

  it('does not fire a combo when a required modifier is missing', () => {
    const onCmdK = vi.fn();
    renderHook(() => useKeydown({ 'cmd+k': onCmdK }));

    pressKey('k');

    expect(onCmdK).not.toHaveBeenCalled();
  });

  it('does not fire a plain key handler when a modifier is held', () => {
    const onK = vi.fn();
    renderHook(() => useKeydown({ k: onK }));

    pressKey('k', { metaKey: true });

    expect(onK).not.toHaveBeenCalled();
  });

  it('supports modifier aliases (meta, control, option)', () => {
    const onMeta = vi.fn();
    const onControl = vi.fn();
    const onOption = vi.fn();
    renderHook(() =>
      useKeydown({
        'meta+a': onMeta,
        'control+b': onControl,
        'option+c': onOption,
      }),
    );

    pressKey('a', { metaKey: true });
    pressKey('b', { ctrlKey: true });
    pressKey('c', { altKey: true });

    expect(onMeta).toHaveBeenCalledTimes(1);
    expect(onControl).toHaveBeenCalledTimes(1);
    expect(onOption).toHaveBeenCalledTimes(1);
  });

  it('resolves "mod" to cmd on mac', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: 'Mozilla (Macintosh)' });
    const onModK = vi.fn();
    renderHook(() => useKeydown({ 'mod+k': onModK }));

    pressKey('k', { metaKey: true });

    expect(onModK).toHaveBeenCalledTimes(1);
  });

  it('resolves "mod" to ctrl on non-mac platforms', () => {
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: 'Mozilla (Windows NT 10.0)' });
    const onModK = vi.fn();
    renderHook(() => useKeydown({ 'mod+k': onModK }));

    pressKey('k', { ctrlKey: true });

    expect(onModK).toHaveBeenCalledTimes(1);
  });

  it('prevents the default behavior on match', () => {
    renderHook(() => useKeydown({ 'cmd+k': vi.fn() }));

    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('uses the latest handler when the map changes between renders', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ handler }) => useKeydown({ ArrowUp: handler }), {
      initialProps: { handler: first },
    });

    rerender({ handler: second });
    pressKey('ArrowUp');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops firing after unmount', () => {
    const onArrowUp = vi.fn();
    const { unmount } = renderHook(() => useKeydown({ ArrowUp: onArrowUp }));

    unmount();
    pressKey('ArrowUp');

    expect(onArrowUp).not.toHaveBeenCalled();
  });
});

describe('useTableKeydown', () => {
  it('starts at index 0', () => {
    const { result } = renderHook(() => useTableKeydown(3));

    expect(result.current.activeIndex).toBe(0);
  });

  it('moves down with ArrowDown and wraps around', () => {
    const { result } = renderHook(() => useTableKeydown(3));

    pressKey('ArrowDown');
    expect(result.current.activeIndex).toBe(1);

    pressKey('ArrowDown');
    pressKey('ArrowDown');
    expect(result.current.activeIndex).toBe(0);
  });

  it('moves up with ArrowUp and wraps around', () => {
    const { result } = renderHook(() => useTableKeydown(3));

    pressKey('ArrowUp');
    expect(result.current.activeIndex).toBe(2);

    pressKey('ArrowUp');
    expect(result.current.activeIndex).toBe(1);
  });

  it('jumps to the last row with End and the first row with Home', () => {
    const { result } = renderHook(() => useTableKeydown(5));

    pressKey('End');
    expect(result.current.activeIndex).toBe(4);

    pressKey('Home');
    expect(result.current.activeIndex).toBe(0);
  });
});
