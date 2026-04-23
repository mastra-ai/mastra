/**
 * Shell-quote a single argument for safe use in a command string.
 */
export function shellQuote(arg: string): string {
  if (/^[a-zA-Z0-9._\-/@:=]+$/.test(arg)) return arg;
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}
