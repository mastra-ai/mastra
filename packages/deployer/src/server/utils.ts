/**
 * Ensures that server.base is normalized.
 *
 * - If server.base is '/' or empty, returns empty string
 * - Normalizes multiple slashes to single slash (e.g., '//' → '/')
 * - Removes trailing slashes (e.g., '/admin/' → '/admin')
 * - Adds leading slash if missing (e.g., 'admin' → '/admin')
 *
 * @param serverBase - The base path to normalize
 * @returns Normalized base path string
 */
export function normalizeServerBase(serverBase: string): string {
  // Validate: no path traversal, no query params, no special chars
  if (serverBase.includes('..') || serverBase.includes('?') || serverBase.includes('#')) {
    throw new Error(`Invalid base path: "${serverBase}". Base path cannot contain '..', '?', or '#'`);
  }

  // Normalize multiple slashes to single slash
  serverBase = serverBase.replace(/\/+/g, '/');

  // Handle default value cases
  if (serverBase === '/' || serverBase === '') {
    return '';
  }

  // Remove trailing slash
  if (serverBase.endsWith('/')) {
    serverBase = serverBase.slice(0, -1);
  }

  // Add leading slash if missing
  if (!serverBase.startsWith('/')) {
    serverBase = `/${serverBase}`;
  }

  return serverBase;
}
