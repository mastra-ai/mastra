/**
 * Returns a shortened version of the commit hash (first 7 characters)
 *
 * @example
 * ```ts
 * const hash = '1234567890abcdef';
 * const shortHash = getShortSha(hash); // Returns "1234567"
 * ```
 */
export function getShortSha(commitHash: string): string {
  return commitHash.slice(0, 7);
}
