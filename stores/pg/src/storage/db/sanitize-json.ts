/**
 * Sanitizes JSON string for PostgreSQL jsonb:
 * - Removes problematic Unicode sequences:
 *   - \u0000 (null character) - causes error 22P05 "unsupported Unicode escape sequence"
 *   - \uD800-\uDFFF (unpaired surrogates) - causes "Unicode low surrogate must follow a high surrogate"
 *   - \\uD800 (escaped-backslash + surrogate, e.g. from JS regex literals like [^\ud800-\udfff]):
 *     removing just \uXXXX would leave a dangling backslash that creates a new invalid escape (e.g. \-)
 * - Escapes any remaining invalid JSON escape sequences (e.g. \v, \k, \-)
 */
export function sanitizeJsonForPg(jsonString: string): string {
  return (
    jsonString
      // Remove null char and surrogate escape sequences. The optional extra backslash (\\\\?)
      // also handles the escaped-backslash variant (\\uXXXX), which would otherwise leave a
      // dangling backslash and produce a new invalid escape sequence after removal.
      .replace(/\\\\?u(0000|[Dd][89A-Fa-f][0-9A-Fa-f]{2})/g, '')
      // Fix any remaining invalid JSON escape sequences safely without rewriting
      // already-escaped backslashes. Running this AFTER surrogate removal ensures that
      // characters newly exposed by the removal (e.g. a hyphen left after \\ud800-\\udfff)
      // are also caught and escaped.
      .replace(/(^|[^\\])(\\(?!["\\/bfnrtu]))/g, '$1\\\\')
  );
}
