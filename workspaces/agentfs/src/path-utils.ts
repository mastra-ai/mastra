/**
 * Path normalization utilities for AgentFS filesystem.
 *
 * AgentFS uses POSIX-style paths with a leading slash.
 */

/**
 * Normalize a path: ensure leading `/`, collapse double slashes, strip trailing slash.
 */
export function normalizePath(input: string): string {
  // Ensure leading slash
  let path = input.startsWith('/') ? input : '/' + input;

  // Collapse consecutive slashes
  let result = '';
  let prevSlash = false;
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === '/') {
      if (!prevSlash) {
        result += ch;
      }
      prevSlash = true;
    } else {
      result += ch;
      prevSlash = false;
    }
  }

  // Strip trailing slash (unless root)
  if (result.length > 1 && result.endsWith('/')) {
    result = result.slice(0, -1);
  }

  return result;
}

/**
 * Get the parent directory path.
 */
export function getParentPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === '/') return '/';
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash <= 0 ? '/' : normalized.slice(0, lastSlash);
}

/**
 * Get the file extension (including the dot).
 * Returns empty string if no extension.
 */
export function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0) return '';
  return filename.slice(dotIndex);
}

/**
 * Join path segments into a normalized path.
 */
export function joinPath(base: string, name: string): string {
  if (base === '/') return normalizePath('/' + name);
  return normalizePath(base + '/' + name);
}

/**
 * Get the filename (last segment) from a path.
 */
export function getBaseName(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === '/') return '';
  const lastSlash = normalized.lastIndexOf('/');
  return normalized.slice(lastSlash + 1);
}
