import { ErrorCategory, MastraError } from '@mastra/core/error';

const SSE_DONE_FRAME = 'data: [DONE]\n\n';
const RECORD_SEPARATOR = '\x1E';
const GENERIC_STREAM_ERROR_MESSAGE = 'An error occurred while processing the stream.';

/** Terminal frame marking a clean end of stream. SSE-only; `stream` format has no end marker. */
export function buildStreamDoneFrame(streamFormat: 'sse' | 'stream'): string | undefined {
  return streamFormat === 'sse' ? SSE_DONE_FRAME : undefined;
}

/**
 * Client-facing error frame for a mid-transmission stream failure. Only a message crosses the
 * wire, never the stack. Arbitrary `Error.message` text is never forwarded as-is — only a
 * `MastraError` tagged `ErrorCategory.USER` (the caller's own fault, e.g. bad input) gets its
 * message exposed; everything else gets a stable generic message so internal details (DB errors,
 * file paths, third-party responses, etc.) never leak to the client. Callers are still expected to
 * log the full `error` server-side before invoking this.
 */
export function buildStreamErrorFrame(error: unknown, streamFormat: 'sse' | 'stream'): string {
  const message =
    error instanceof MastraError && error.category === ErrorCategory.USER
      ? error.message
      : GENERIC_STREAM_ERROR_MESSAGE;
  const json = JSON.stringify({ type: 'error', payload: { error: { message } } });
  return streamFormat === 'sse' ? `data: ${json}\n\n` : json + RECORD_SEPARATOR;
}
