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
