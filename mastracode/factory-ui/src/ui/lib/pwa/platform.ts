/**
 * iOS/iPadOS detection for the manual "Add to Home Screen" install path.
 * UA sniffing is unavoidable here: there is no capability check for the iOS
 * share-menu install flow. iPadOS can report a macOS user agent, so touch
 * support disambiguates it from desktop Safari.
 */
export function isIosSafariLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  const { userAgent, maxTouchPoints } = navigator;
  // Third-party iOS browsers (Chrome, Firefox, Edge, Opera) also report
  // iPhone/iPad, but our instructions describe Safari's share-menu flow.
  if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(userAgent)) return false;
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}
