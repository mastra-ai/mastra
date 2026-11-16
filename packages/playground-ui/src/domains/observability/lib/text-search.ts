/** Normalizes the existing search chip draft without importing server-only storage code. */
export function effectiveTextSearch(value: string | undefined): string | undefined {
  const text = value?.trim().replace(/[A-Z]/g, character => character.toLowerCase());
  if (!text) return undefined;
  const length = Array.from(text).length;
  return length >= 3 && length <= 256 ? text : undefined;
}
