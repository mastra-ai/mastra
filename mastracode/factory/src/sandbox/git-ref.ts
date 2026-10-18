/**
 * Validate a branch/ref name before persistence or use in a Git command.
 * The conservative character allowlist is paired with Git's structural rules
 * so accepted values remain valid when a workspace is materialized later.
 */
export function isValidGitRef(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 255 || !/^[A-Za-z0-9_./-]+$/.test(value)) {
    return false;
  }
  if (
    value.startsWith('-') ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.endsWith('.') ||
    value.includes('..') ||
    value.includes('//')
  ) {
    return false;
  }
  return value.split('/').every(component => !component.startsWith('.') && !component.toLowerCase().endsWith('.lock'));
}
