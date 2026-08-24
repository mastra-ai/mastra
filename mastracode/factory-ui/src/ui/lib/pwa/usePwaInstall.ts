import { useEffect, useRef, useState } from 'react';

import { detectIosBrowser } from './platform';
import {
  getDismissalRemainingMs,
  isManuallyInstalled,
  markDismissed,
  markManuallyInstalled,
  wasRecentlyDismissed,
} from './persistence';
import { isRunningStandalone } from './standalone';

/** Non-standard Chromium event; not in lib.dom, so typed locally. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

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
  // Chromium signals native installability later via `beforeinstallprompt`.
  return 'unavailable';
}

/**
 * Centralizes PWA install state: captures Chromium's `beforeinstallprompt`
 * for a user-gesture-triggered native prompt, falls back to the manual
 * "Add to Home Screen" method on iOS browsers, and tracks dismissal.
 */
export function usePwaInstall(): PwaInstall {
  const [state, setState] = useState<PwaInstallState>(computeInitialState);
  const [dismissed, setDismissed] = useState(wasRecentlyDismissed);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Suppress Chromium's mini-infobar; we prompt from our own banner.
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setState(previous => (previous === 'installed' ? previous : 'native-prompt-available'));
    };
    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setState('installed');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
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
    const deferredPrompt = deferredPromptRef.current;
    if (!deferredPrompt) return;
    // A BeforeInstallPromptEvent is single-use; consume it either way.
    deferredPromptRef.current = null;
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
