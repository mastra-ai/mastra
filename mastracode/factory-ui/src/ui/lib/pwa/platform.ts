export type IosBrowser = 'safari' | 'chrome' | 'firefox' | 'edge' | 'opera';

/**
 * Detects iOS/iPadOS browsers for the manual "Add to Home Screen" install
 * path (no `beforeinstallprompt` on iOS; all browsers support the share-menu
 * install since iOS 16.4, but the entry point differs per browser). UA
 * sniffing is unavoidable: there is no capability check for this flow.
 * iPadOS can report a macOS user agent, so touch support disambiguates it
 * from desktop Safari. Returns null off iOS.
 */
export function detectIosBrowser(): IosBrowser | null {
  if (typeof navigator === 'undefined') return null;
  const { userAgent, maxTouchPoints } = navigator;
  const isIos = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  if (!isIos) return null;
  if (/CriOS/.test(userAgent)) return 'chrome';
  if (/FxiOS/.test(userAgent)) return 'firefox';
  if (/EdgiOS/.test(userAgent)) return 'edge';
  if (/OPiOS|OPT\//.test(userAgent)) return 'opera';
  return 'safari';
}
