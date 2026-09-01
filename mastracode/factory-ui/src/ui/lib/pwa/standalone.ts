/**
 * Detects whether the app is currently running as an installed PWA
 * (Chromium standalone display mode, or iOS Home-Screen web app).
 */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch {
    /* matchMedia unavailable */
  }
  // iOS Safari exposes a non-standard `navigator.standalone` flag.
  return (window.navigator as { standalone?: boolean }).standalone === true;
}
