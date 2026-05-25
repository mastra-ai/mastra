/**
 * Strip the configured prefix from a request path to produce the
 * Mastra-relative route path used for SERVER_ROUTES matching.
 */
export function getMastraRoutePath(path: string, prefix?: string): string | null {
  // Normalize prefix - ensure it has leading slash but no trailing slash
  let normalizedPrefix = prefix || '';
  if (normalizedPrefix && !normalizedPrefix.startsWith('/')) {
    normalizedPrefix = '/' + normalizedPrefix;
  }
  if (normalizedPrefix.endsWith('/')) {
    normalizedPrefix = normalizedPrefix.slice(0, -1);
  }

  // Remove prefix from path for matching
  let routePath = path;
  if (normalizedPrefix) {
    if (path !== normalizedPrefix && !path.startsWith(normalizedPrefix + '/')) {
      return null;
    }

    routePath = path.slice(normalizedPrefix.length);
    // Ensure routePath starts with / if not empty
    if (routePath && !routePath.startsWith('/')) {
      routePath = '/' + routePath;
    }
  }

  if (!routePath) {
    routePath = '/';
  }

  return routePath;
}
