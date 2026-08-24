/**
 * iOS/iPadOS detection for the manual "Add to Home Screen" install path.
 * UA sniffing is unavoidable here: there is no capability check for the iOS
 * share-menu install flow. iPadOS can report a macOS user agent, so touch
 * support disambiguates it from desktop Safari.
 */
export function isIosSafariLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const { userAgent, maxTouchPoints } = navigator;
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}
