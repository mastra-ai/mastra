// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useIsApplePlatform, useKeyboardShortcutLabel } from './use-keyboard-shortcut-label';

const setNavigatorValue = <T,>(property: keyof Navigator | 'userAgentData', value: T) => {
  Object.defineProperty(window.navigator, property, {
    configurable: true,
    value,
  });
};

describe('useKeyboardShortcutLabel', () => {
  afterEach(() => {
    Reflect.deleteProperty(window.navigator, 'platform');
    Reflect.deleteProperty(window.navigator, 'userAgent');
    Reflect.deleteProperty(window.navigator, 'userAgentData');
  });

  it('uses the Command symbol on Apple platforms', () => {
    setNavigatorValue('platform', 'MacIntel');
    setNavigatorValue('userAgent', '');

    const { result } = renderHook(() => useKeyboardShortcutLabel('k'));

    expect(result.current).toBe('⌘ K');
  });

  it('uses Ctrl on Windows platforms', () => {
    setNavigatorValue('platform', 'Win32');
    setNavigatorValue('userAgent', 'Windows');

    const { result } = renderHook(() => useKeyboardShortcutLabel('K'));

    expect(result.current).toBe('Ctrl K');
  });

  it('prefers userAgentData platform when available', () => {
    setNavigatorValue('platform', 'Win32');
    setNavigatorValue('userAgentData', { platform: 'macOS' });

    const { result } = renderHook(() => useKeyboardShortcutLabel('p'));

    expect(result.current).toBe('⌘ P');
  });

  it('recognizes an Apple platform from the user agent alone', () => {
    setNavigatorValue('platform', '');
    setNavigatorValue('userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');

    expect(renderHook(() => useKeyboardShortcutLabel('k')).result.current).toBe('⌘ K');
  });

  it('falls back to the legacy platform when userAgentData carries none', () => {
    setNavigatorValue('platform', 'MacIntel');
    setNavigatorValue('userAgent', '');
    setNavigatorValue('userAgentData', {});

    expect(renderHook(() => useKeyboardShortcutLabel('k')).result.current).toBe('⌘ K');
  });

  it('uses Ctrl when the platform cannot be identified at all', () => {
    setNavigatorValue('platform', '');
    setNavigatorValue('userAgent', '');

    expect(renderHook(() => useKeyboardShortcutLabel('k')).result.current).toBe('Ctrl K');
  });

  it('normalizes the key it is given', () => {
    setNavigatorValue('platform', 'Win32');
    setNavigatorValue('userAgent', 'Windows');

    expect(renderHook(() => useKeyboardShortcutLabel('  k  ')).result.current).toBe('Ctrl K');
    expect(renderHook(() => useKeyboardShortcutLabel('enter')).result.current).toBe('Ctrl ENTER');
  });

  it('reports the platform on its own', () => {
    setNavigatorValue('platform', 'MacIntel');
    setNavigatorValue('userAgent', '');
    expect(renderHook(() => useIsApplePlatform()).result.current).toBe(true);

    setNavigatorValue('platform', 'Win32');
    expect(renderHook(() => useIsApplePlatform()).result.current).toBe(false);
  });
});
