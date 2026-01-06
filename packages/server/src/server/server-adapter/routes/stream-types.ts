/**
 * Union type for all valid streaming return values.
 *
 * Streaming handlers (routes with responseType: 'stream') must return one of these types.
 * Server adapters extract the ReadableStream and send chunks to the client.
 */
export type MastraStreamReturn =
  // Raw ReadableStream (most common - from .fullStream extraction)
  | ReadableStream
  // Wrapped ReadableStream (for handlers that need to preserve stream reference)
  | { fullStream: ReadableStream };
