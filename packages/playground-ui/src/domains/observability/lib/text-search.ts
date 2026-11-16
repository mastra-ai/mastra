/** Matches the API's Unicode code-point limits without importing server-only storage code. */
export function effectiveTextSearch(value: string | undefined): string | undefined {
  const text = value?.trim().toLowerCase();
  if (!text) return undefined;
  const length = Array.from(text).length;
  return length >= 3 && length <= 256 ? text : undefined;
}
