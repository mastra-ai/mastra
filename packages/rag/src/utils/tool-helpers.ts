/**
 * Coerces a topK value to a number, handling string inputs and providing a default.
 * @param topK - The value to coerce (number, string, or undefined)
 * @param defaultValue - Default value if coercion fails (defaults to 10)
 * @returns A valid number for topK
 */
export function coerceTopK(topK: number | string | undefined, defaultValue: number = 10): number {
  if (typeof topK === 'number' && !isNaN(topK)) {
    return topK;
  }
  if (typeof topK === 'string' && !isNaN(Number(topK))) {
    return Number(topK);
  }
  return defaultValue;
}

interface Logger {
  error(message: string, data?: Record<string, unknown>): void;
}

/**
 * Parses a filter value, handling both string (JSON) and object inputs.
 * @param filter - The filter value to parse (string or object)
 * @param logger - Optional logger for error reporting
 * @returns Parsed filter object
 * @throws Error if filter is a string that cannot be parsed as JSON
 */
export function parseFilterValue(filter: unknown, logger?: Logger | null): Record<string, any> {
  if (!filter) {
    return {};
  }

  try {
    return typeof filter === 'string' ? JSON.parse(filter) : (filter as Record<string, any>);
  } catch (error) {
    if (logger) {
      logger.error('Invalid filter', { filter, error });
    }
    throw new Error(`Invalid filter format: ${error instanceof Error ? error.message : String(error)}`);
  }
}
