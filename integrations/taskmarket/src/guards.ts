/**
 * Canonical object guard for this package. Values parsed from CLI output are
 * JSON, so the shape is only known at runtime; narrow with this guard and
 * validate fields with `typeof`/`in` before use.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}
