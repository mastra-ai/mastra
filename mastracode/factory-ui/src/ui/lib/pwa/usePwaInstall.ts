import { useEffect, useState } from 'react';

import {
  captureInstallPrompt,
  getCapturedInstallPrompt,
  subscribeToInstallPrompt,
  takeCapturedInstallPrompt,
} from './installPromptCapture';
import { detectIosBrowser } from './platform';
import {
  getDismissalRemainingMs,
  isManuallyInstalled,
  markDismissed,
  markManuallyInstalled,
  wasRecentlyDismissed,
} from './persistence';
import { isRunningStandalone } from './standalone';

export type { BeforeInstallPromptEvent } from './installPromptCapture';

export type PwaInstallState = 'installed' | 'native-prompt-available' | 'manual-install' | 'unavailable';

export interface PwaInstall {
  state: PwaInstallState;
  /** True when the banner should be offered: an install path exists and it wasn't recently dismissed. */
  canInstall: boolean;
  isInstalled: boolean;
  installationMethod: 'native' | 'manual' | null;
  install: () => Promise<void>;
  dismiss: () => void;
}

function computeInitialState(): PwaInstallState {
  if (isRunningStandalone() || isManuallyInstalled()) return 'installed';
  if (detectIosBrowser() !== null) return 'manual-install';
  // Chromium signals native installability via `beforeinstallprompt`, which
  // may already have been captured before this hook mounted.
  return getCapturedInstallPrompt() ? 'native-prompt-available' : 'unavailable';
}

/**
 * Centralizes PWA install state: uses Chromium's `beforeinstallprompt`
 * (captured app-wide by `captureInstallPrompt`) for a user-gesture-triggered
 * native prompt, falls back to the manual "Add to Home Screen" method on iOS
 * browsers, and tracks dismissal.
 */
export function usePwaInstall(): PwaInstall {
  const [state, setState] = useState<PwaInstallState>(computeInitialState);
  const [dismissed, setDismissed] = useState(wasRecentlyDismissed);

  useEffect(() => {
    captureInstallPrompt();
    const syncCapturedPrompt = () => {
      if (!getCapturedInstallPrompt()) return;
      setState(previous => (previous === 'installed' ? previous : 'native-prompt-available'));
    };
    const onAppInstalled = () => setState('installed');
    const unsubscribe = subscribeToInstallPrompt(syncCapturedPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    // A prompt may have been captured between the first render and this effect.
    syncCapturedPrompt();
    return () => {
      unsubscribe();
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  // While dismissed, schedule the banner to reappear when the window expires.
  useEffect(() => {
    if (!dismissed) return;
    const timeout = setTimeout(() => setDismissed(false), getDismissalRemainingMs());
    return () => clearTimeout(timeout);
  }, [dismissed]);

  const install = async () => {
    if (state === 'manual-install') {
      // No install API on iOS: showing the instructions is our best proxy.
      markManuallyInstalled();
      setState('installed');
      return;
    }
    // A BeforeInstallPromptEvent is single-use; consume it either way.
    const deferredPrompt = takeCapturedInstallPrompt();
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setState(outcome === 'accepted' ? 'installed' : 'unavailable');
  };

  const dismiss = () => {
    markDismissed();
    setDismissed(true);
  };

  const isInstalled = state === 'installed';
  const installable = state === 'native-prompt-available' || state === 'manual-install';

  return {
    state,
    canInstall: installable && !dismissed,
    isInstalled,
    installationMethod: state === 'native-prompt-available' ? 'native' : state === 'manual-install' ? 'manual' : null,
    install,
    dismiss,
  };
}
