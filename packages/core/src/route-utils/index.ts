/**
 * Route utilities for path normalization.
 *
 * NOTE: This module is intentionally separate from @mastra/core/utils because
 * utils.ts imports Node.js-only dependencies (like 'node:crypto') that break
 * browser builds. This module is browser-safe and can be imported by client-side
 * packages like @mastra/client-js.
 */

/**
 * Normalizes a route path to ensure consistent formatting:
 * - Adds leading slash if missing (e.g., 'admin' → '/admin')
 * - Removes trailing slashes (e.g., '/admin/' → '/admin')
 * - Normalizes multiple slashes to single slash (e.g., '//api' → '/api')
 * - Returns empty string for root paths ('/' or '')
 * - Trims whitespace
 *
 * @param path - The route path to normalize (e.g., 'mastra', '/mastra/', '/mastra')
 * @returns Normalized path with leading slash and no trailing slash (e.g., '/mastra')
 * @throws Error if path contains invalid characters ('..', '?', '#')
 *
 * @example
 * ```typescript
 * normalizeRoutePath('api');       // '/api'
 * normalizeRoutePath('/api/');     // '/api'
 * normalizeRoutePath('//api//v1'); // '/api/v1'
 * normalizeRoutePath('/');         // ''
 * ```
 */
export function normalizeRoutePath(path: string): string {
  let normalized = path.trim();

  // Validate: no path traversal, no query params, no special chars
  if (normalized.includes('..') || normalized.includes('?') || normalized.includes('#')) {
    throw new Error(`Invalid route path: "${path}". Path cannot contain '..', '?', or '#'`);
  }

  // Normalize multiple slashes to single slash
  normalized = normalized.replace(/\/+/g, '/');

  // Handle default value cases (empty or just '/')
  if (normalized === '/' || normalized === '') {
    return '';
  }

  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  // Add leading slash if missing
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  return normalized;
}
