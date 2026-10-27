/**
 * Response id and timestamp to use until the provider sends `response-metadata`.
 * Providers that never send it (e.g. Gemini) keep these values, so every engine
 * still reports an id and timestamp. Provider values override them when they arrive.
 */
export function fallbackResponseMetadata({
  generateId,
  currentDate,
}: {
  generateId?: () => string;
  currentDate?: () => Date;
}): { id: string; timestamp: Date } {
  return {
    id: generateId?.() || globalThis.crypto.randomUUID(),
    timestamp: currentDate?.() ?? new Date(),
  };
}
