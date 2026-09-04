/**
 * Minimal SSE reader over a fetch ReadableStream. Parses `event:`/`data:` frames
 * separated by blank lines and invokes `onEvent` for each. Defaults the event
 * name to `message` per the SSE spec.
 */
export async function readSSE(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // A CRLF split across two reads: normalizing the lone \r now would fabricate
  // a blank line and cut the frame in half, so it waits for its \n.
  let danglingCR = '';
  for (;;) {
    const { done, value } = await reader.read();
    // The last read still flushes: a CR-only stream ends on the held \r.
    const chunk = danglingCR + (done ? '' : decoder.decode(value, { stream: true }));
    danglingCR = !done && chunk.endsWith('\r') ? '\r' : '';
    // Normalize CRLF/CR to LF so frame and line splitting work regardless of
    // how the server terminates SSE lines (the spec allows \r\n, \r, or \n).
    buffer += (danglingCR ? chunk.slice(0, -1) : chunk).replace(/\r\n|\r/g, '\n');
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
      }
      if (dataLines.length > 0) onEvent(event, dataLines.join('\n'));
    }
    if (done) break;
  }
}
