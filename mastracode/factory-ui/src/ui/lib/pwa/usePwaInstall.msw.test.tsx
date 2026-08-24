import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BeforeInstallPromptEvent } from './usePwaInstall';
import { INSTALL_BANNER_DISMISS_DURATION_MS } from './persistence';
import { usePwaInstall } from './usePwaInstall';

const DISMISSED_KEY = 'mastracode.pwaInstallDismissedAt';
const INSTALLED_KEY = 'mastracode.pwaInstalledManually';

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const originalUserAgent = navigator.userAgent;
const originalMatchMedia = window.matchMedia;

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
}

function setStandalone(standalone: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      matches: standalone && query === '(display-mode: standalone)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

function createInstallPromptEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  const prompt = vi.fn(() => Promise.resolve());
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome, platform: 'web' }) });
  return { event, prompt };
}

beforeEach(() => {
  localStorage.removeItem(DISMISSED_KEY);
  localStorage.removeItem(INSTALLED_KEY);
});

afterEach(() => {
  setUserAgent(originalUserAgent);
  window.matchMedia = originalMatchMedia;
});

describe('usePwaInstall', () => {
  it('starts unavailable on non-iOS browsers without a native prompt', () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.state).toBe('unavailable');
    expect(result.current.canInstall).toBe(false);
    expect(result.current.installationMethod).toBeNull();
  });

  it('captures beforeinstallprompt, prevents the default mini-infobar, and enables native install', () => {
    const { result } = renderHook(() => usePwaInstall());
    const { event } = createInstallPromptEvent('accepted');

    act(() => void window.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(result.current.state).toBe('native-prompt-available');
    expect(result.current.canInstall).toBe(true);
    expect(result.current.installationMethod).toBe('native');
  });

  it('offers the manual method on iOS-like Safari', () => {
    setUserAgent(IOS_UA);
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.state).toBe('manual-install');
    expect(result.current.canInstall).toBe(true);
    expect(result.current.installationMethod).toBe('manual');
  });

  it('offers the manual method on Chrome iOS too', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
    );
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.state).toBe('manual-install');
    expect(result.current.installationMethod).toBe('manual');
  });

  it('reports installed when running standalone', () => {
    setStandalone(true);
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.state).toBe('installed');
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it('reports installed when the iOS manual-install flag is set', () => {
    setUserAgent(IOS_UA);
    localStorage.setItem(INSTALLED_KEY, 'true');
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.state).toBe('installed');
    expect(result.current.canInstall).toBe(false);
  });

  it('install() prompts natively and becomes installed on accepted', async () => {
    const { result } = renderHook(() => usePwaInstall());
    const { event, prompt } = createInstallPromptEvent('accepted');
    act(() => void window.dispatchEvent(event));

    await act(() => result.current.install());

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe('installed');
  });

  it('install() tolerates a dismissed prompt and never reuses the consumed event', async () => {
    const { result } = renderHook(() => usePwaInstall());
    const { event, prompt } = createInstallPromptEvent('dismissed');
    act(() => void window.dispatchEvent(event));

    await act(() => result.current.install());
    expect(result.current.state).toBe('unavailable');

    await act(() => result.current.install());
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('install() on iOS marks the app manually installed', async () => {
    setUserAgent(IOS_UA);
    const { result } = renderHook(() => usePwaInstall());

    await act(() => result.current.install());

    expect(localStorage.getItem(INSTALLED_KEY)).toBe('true');
    expect(result.current.state).toBe('installed');
  });

  it('becomes installed on the appinstalled event', () => {
    const { result } = renderHook(() => usePwaInstall());
    const { event } = createInstallPromptEvent('accepted');
    act(() => void window.dispatchEvent(event));

    act(() => void window.dispatchEvent(new Event('appinstalled')));

    expect(result.current.state).toBe('installed');
    expect(result.current.canInstall).toBe(false);
  });

  it('dismiss() hides the banner and persists the timestamp', () => {
    const { result } = renderHook(() => usePwaInstall());
    const { event } = createInstallPromptEvent('accepted');
    act(() => void window.dispatchEvent(event));

    act(() => result.current.dismiss());

    expect(result.current.canInstall).toBe(false);
    expect(localStorage.getItem(DISMISSED_KEY)).not.toBeNull();
  });

  it('stays hidden while a recent dismissal is in effect', () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now() - 1000));
    const { result } = renderHook(() => usePwaInstall());
    const { event } = createInstallPromptEvent('accepted');
    act(() => void window.dispatchEvent(event));

    expect(result.current.state).toBe('native-prompt-available');
    expect(result.current.canInstall).toBe(false);
  });

  it('becomes eligible again when the dismissal window expires without a remount', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => usePwaInstall());
      const { event } = createInstallPromptEvent('accepted');
      act(() => void window.dispatchEvent(event));

      act(() => result.current.dismiss());
      expect(result.current.canInstall).toBe(false);

      act(() => void vi.advanceTimersByTime(INSTALL_BANNER_DISMISS_DURATION_MS + 1000));
      expect(result.current.canInstall).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('becomes eligible again after the dismissal window expires', () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now() - INSTALL_BANNER_DISMISS_DURATION_MS - 1000));
    const { result } = renderHook(() => usePwaInstall());
    const { event } = createInstallPromptEvent('accepted');
    act(() => void window.dispatchEvent(event));

    expect(result.current.canInstall).toBe(true);
  });
});
