export class ToolNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolNotFoundError';
  }
}

/**
 * Plain shape an Error gets reduced to when it crosses the evented engine's
 * pubsub boundary. `JSON.stringify(error)` returns `{}` since `name`, `message`,
 * and `stack` live on the prototype, so we capture them explicitly — plus any
 * extra enumerable own properties (e.g. AssertionError's `actual`/`expected`) —
 * and reify on the consumer side.
 */
export type SerializedError = { name: string; message: string; stack?: string } & Record<string, unknown>;

const RESERVED_KEYS = new Set(['name', 'message', 'stack']);

export function serializeToolError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...Object.fromEntries(Object.entries(error).filter(([key]) => !RESERVED_KEYS.has(key))),
    };
  }
  if (error && typeof error === 'object') {
    const data = error as Record<string, unknown>;
    if (typeof data.message === 'string') {
      return {
        name: typeof data.name === 'string' ? data.name : 'Error',
        message: data.message,
        stack: typeof data.stack === 'string' ? data.stack : undefined,
        ...Object.fromEntries(Object.entries(data).filter(([key]) => !RESERVED_KEYS.has(key))),
      };
    }
  }
  return { name: 'Error', message: String(error) };
}

export function deserializeToolError(value: unknown): Error {
  if (value instanceof Error) return value;
  const data = (value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined) ?? {};
  const message = typeof data.message === 'string' ? data.message : String(value);
  const error = new Error(message);
  if (typeof data.name === 'string' && data.name.length > 0) error.name = data.name;
  if (typeof data.stack === 'string') error.stack = data.stack;
  // Restore any extra enumerable own properties the original Error carried
  // (e.g. AssertionError's `actual`/`expected`). Reserved keys are already set above.
  for (const [key, val] of Object.entries(data)) {
    if (RESERVED_KEYS.has(key)) continue;
    (error as unknown as Record<string, unknown>)[key] = val;
  }
  return error;
}
