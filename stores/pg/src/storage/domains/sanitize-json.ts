/**
 * Sanitizes serialized JSON before a PostgreSQL jsonb cast.
 *
 * PostgreSQL rejects NUL escapes and unpaired UTF-16 surrogate escapes. The
 * escaped-backslash variant is removed as a unit so it cannot leave behind an
 * invalid JSON escape, and any other invalid escapes are made literal.
 */
export function sanitizeJsonForPg(jsonString: string): string {
  return jsonString
    .replace(/\\\\?u(0000|[Dd][89A-Fa-f][0-9A-Fa-f]{2})/g, '')
    .replace(/(^|[^\\])(\\(?!["\\/bfnrtu]))/g, '$1\\\\');
}
