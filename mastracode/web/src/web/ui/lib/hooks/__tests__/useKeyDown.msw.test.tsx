import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useKeyDown } from '../useKeyDown';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useKeyDown', () => {
  it('calls the matching callback with the native keyboard event', () => {
    const onCtrlX = vi.fn<(event: KeyboardEvent) => void>();

    renderHook(() => useKeyDown({ 'ctrl+x': onCtrlX }));

    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });

    expect(onCtrlX).toHaveBeenCalledTimes(1);
    expect(onCtrlX.mock.calls[0]?.[0]).toBeInstanceOf(KeyboardEvent);
  });

  it('requires exact modifiers for explicit modifier bindings', () => {
    const onCtrlX = vi.fn<(event: KeyboardEvent) => void>();

    renderHook(() => useKeyDown({ 'ctrl+x': onCtrlX }));

    fireEvent.keyDown(window, { key: 'x' });
    fireEvent.keyDown(window, { key: 'x', metaKey: true });
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true, shiftKey: true });

    expect(onCtrlX).not.toHaveBeenCalled();
  });

  it('treats mod as ctrl or meta', () => {
    const onModK = vi.fn<(event: KeyboardEvent) => void>();

    renderHook(() => useKeyDown({ 'mod+k': onModK }));

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(onModK).toHaveBeenCalledTimes(2);
  });

  it('supports escape and printable shifted keys', () => {
    const onEscape = vi.fn<(event: KeyboardEvent) => void>();
    const onQuestion = vi.fn<(event: KeyboardEvent) => void>();

    renderHook(() => useKeyDown({ escape: onEscape, '?': onQuestion }));

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: '?', shiftKey: true });

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onQuestion).toHaveBeenCalledTimes(1);
  });

  it('does not re-register the window listener when bindings change each render', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');

    const { rerender } = renderHook(({ value }: { value: number }) => useKeyDown({ 'ctrl+x': () => value }), {
      initialProps: { value: 1 },
    });

    rerender({ value: 2 });
    rerender({ value: 3 });
    rerender({ value: 4 });

    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), false);
    expect(removeEventListener).not.toHaveBeenCalled();
  });

  it('uses the latest callback without re-registering the listener', () => {
    const calls: number[] = [];
    const addEventListener = vi.spyOn(window, 'addEventListener');

    const { rerender } = renderHook(
      ({ value }: { value: number }) => useKeyDown({ 'ctrl+x': () => calls.push(value) }),
      { initialProps: { value: 1 } },
    );

    rerender({ value: 2 });
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });

    expect(calls).toEqual([2]);
    expect(addEventListener).toHaveBeenCalledTimes(1);
  });

  it('detaches when disabled and re-attaches when enabled', () => {
    const onEscape = vi.fn<(event: KeyboardEvent) => void>();
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useKeyDown({ escape: onEscape }, { enabled }),
      { initialProps: { enabled: true } },
    );

    rerender({ enabled: false });
    fireEvent.keyDown(window, { key: 'Escape' });
    rerender({ enabled: true });
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(addEventListener).toHaveBeenCalledTimes(2);
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('can attach to document with capture', () => {
    const onEscape = vi.fn<(event: KeyboardEvent) => void>();
    const addEventListener = vi.spyOn(document, 'addEventListener');
    const removeEventListener = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyDown({ escape: onEscape }, { target: 'document', capture: true }));

    fireEvent.keyDown(document, { key: 'Escape' });
    unmount();

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);
  });

  it('removes the listener on unmount', () => {
    const removeEventListener = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyDown({ escape: () => undefined }));

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), false);
  });

  it('calls only the first matching binding', () => {
    const first = vi.fn<(event: KeyboardEvent) => void>();
    const second = vi.fn<(event: KeyboardEvent) => void>();
    const unrelated = vi.fn<(event: KeyboardEvent) => void>();

    renderHook(() => useKeyDown({ escape: first, Escape: second, enter: unrelated }));

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Tab' });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(unrelated).not.toHaveBeenCalled();
  });
});
