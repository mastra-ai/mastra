/** Narrows an unknown to a readable object, so callers can check fields without `in` chains. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
