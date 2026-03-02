/**
 * Shell-quote an argument for safe interpolation into a shell command string.
 * Safe characters (alphanumeric, `.`, `_`, `-`, `/`, `=`, `:`, `@`) pass through.
 * Everything else is wrapped in single quotes with embedded quotes escaped.
 */
export function shellQuote(arg: string): string {
  if (/^[a-zA-Z0-9._\-\/=:@]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, "'\\''")}'`;
}
