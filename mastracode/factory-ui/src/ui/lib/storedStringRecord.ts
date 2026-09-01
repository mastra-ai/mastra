/** The `Record<string, string>` persisted under `key`; anything else stored there reads as empty. */
export function readStoredStringRecord(key: string): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
}
