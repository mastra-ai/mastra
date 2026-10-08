/**
 * A build or setup error may echo a clone URL or a token; strip URL userinfo
 * and GitHub token shapes before the message is stored, logged or shown.
 */
export function redactCredentials(message: string): string {
  return message.replace(/\/\/[^/\s@]+@/g, '//***@').replace(/\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]+/g, '***');
}
