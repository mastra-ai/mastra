/**
 * localStorage persistence for the PWA install banner: "Not now" dismissals
 * (re-eligible after a window) and the iOS manual-install flag. All access is
 * guarded — storage failures must never break the app.
 */

export const INSTALL_BANNER_DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const DISMISSED_AT_KEY = 'mastracode.pwaInstallDismissedAt';
const MANUALLY_INSTALLED_KEY = 'mastracode.pwaInstalledManually';

export function wasRecentlyDismissed(): boolean {
  try {
    const stored = localStorage.getItem(DISMISSED_AT_KEY);
    if (!stored) return false;
    const dismissedAt = Number(stored);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < INSTALL_BANNER_DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

/** Milliseconds until the current dismissal expires, or 0 if not dismissed. */
export function getDismissalRemainingMs(): number {
  try {
    const stored = localStorage.getItem(DISMISSED_AT_KEY);
    if (!stored) return 0;
    const dismissedAt = Number(stored);
    if (!Number.isFinite(dismissedAt)) return 0;
    return Math.max(0, dismissedAt + INSTALL_BANNER_DISMISS_DURATION_MS - Date.now());
  } catch {
    return 0;
  }
}

export function markDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
  } catch {
    /* non-fatal */
  }
}

/**
 * iOS has no `appinstalled` event; once the install instructions have been
 * shown we assume the user followed them and stop prompting.
 */
export function isManuallyInstalled(): boolean {
  try {
    return localStorage.getItem(MANUALLY_INSTALLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markManuallyInstalled(): void {
  try {
    localStorage.setItem(MANUALLY_INSTALLED_KEY, 'true');
  } catch {
    /* non-fatal */
  }
}
