/** A plain object, not an array or null. Used to read untyped JSON Schema and tool metadata. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
