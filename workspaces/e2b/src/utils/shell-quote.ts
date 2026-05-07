/**
 * Shell-quote a single argument for safe use in a command string.
 *
 * Arguments containing only safe characters are returned as-is.
 * All others are wrapped in single quotes with embedded single quotes escaped.
 */
export function shellQuote(arg: string): string {
  // Safe characters that don't need quoting
  if (/^[a-zA-Z0-9._\-/@:=]+$/.test(arg)) return arg;
  // Wrap in single quotes, escaping any embedded single quotes
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}
