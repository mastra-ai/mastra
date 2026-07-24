/**
 * Prefix a same-origin app URL with the studio base path (server `studioBase` option).
 *
 * Needed for full-page navigations via `window.location` which bypass the
 * react-router basename (e.g. redirecting to the login page). External URLs
 * and URLs which already include the studio base path are preserved.
 */
export function withStudioBasePath(path: string): string {
  const basePath = (window.MASTRA_STUDIO_BASE_PATH ?? '').replace(/\/$/, '');
  if (!basePath) return path;

  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) return path;

  const appPath = `${url.pathname}${url.search}${url.hash}`;
  if (url.pathname === basePath || url.pathname.startsWith(`${basePath}/`)) return appPath;

  return `${basePath}${url.pathname}${url.search}${url.hash}`;
}
