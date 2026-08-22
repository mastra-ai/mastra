const SSE_DONE_FRAME = 'data: [DONE]\n\n';
const RECORD_SEPARATOR = '\x1E';

/** Terminal frame marking a clean end of stream. SSE-only; `stream` format has no end marker. */
export function buildStreamDoneFrame(streamFormat: 'sse' | 'stream'): string | undefined {
  return streamFormat === 'sse' ? SSE_DONE_FRAME : undefined;
}

/** Client-facing error frame for a mid-transmission stream failure. Only the message crosses the wire, not the stack. */
export function buildStreamErrorFrame(error: unknown, streamFormat: 'sse' | 'stream'): string {
  const message = error instanceof Error ? error.message : String(error);
  const json = JSON.stringify({ type: 'error', payload: { error: { message } } });
  return streamFormat === 'sse' ? `data: ${json}\n\n` : json + RECORD_SEPARATOR;
}
