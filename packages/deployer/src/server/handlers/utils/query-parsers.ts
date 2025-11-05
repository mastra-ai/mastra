/**
 * Parse a limit query parameter value to a valid number
 * @param rawLimit - The raw limit value from query parameters
 * @returns A valid positive integer or undefined
 */
export function parseLimit(rawLimit: string | undefined): number | undefined {
  if (rawLimit === undefined) {
    return undefined;
  }

  const n = Number(rawLimit);
  if (Number.isFinite(n) && Number.isInteger(n) && n > 0) {
    return n;
  }

  return undefined;
}

/**
 * Parse a page query parameter value to a valid non-negative number
 * @param value - The raw page value from query parameters
 * @param defaultValue - The default value to use if parsing fails (default: 0)
 * @returns A valid non-negative integer
 */
export function parsePage(value: string | undefined, defaultValue: number = 0): number {
  const parsed = parseInt(value || String(defaultValue), 10);
  return isNaN(parsed) ? defaultValue : Math.max(0, parsed);
}

/**
 * Parse a perPage query parameter value to a valid positive number with a maximum cap, or false to fetch all
 * @param value - The raw perPage value from query parameters
 * @param defaultValue - The default value to use if parsing fails (default: 100)
 * @param max - The maximum allowed value (default: 1000)
 * @returns A valid positive integer between 1 and max, or false to bypass pagination
 */
export function parsePerPage(
  value: string | undefined,
  defaultValue: number = 100,
  max: number = 1000,
): number | false {
  const normalized = (value || '').trim().toLowerCase();
  // Handle explicit false to bypass pagination
  if (normalized === 'false') {
    return false;
  }
  const parsed = parseInt(value || String(defaultValue), 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.min(max, Math.max(1, parsed));
}
