// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useKeyboardShortcutLabel } from './use-keyboard-shortcut-label';

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
});
