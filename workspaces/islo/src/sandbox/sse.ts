/**
 * SSE consumer for the islo `/sandboxes/{name}/exec/stream` endpoint.
 *
 * The TypeScript SDK's `execInSandboxStream` decodes the response body into
 * `unknown` through the standard fetcher — by the time you see bytes the
 * command is done. We bypass it here so callers see stdout/stderr deltas as
 * they arrive.
 *
 * Wire format (verified against api.islo.dev): standard `text/event-stream`.
 * Each event has an `event:` type line (`stdout`, `stderr`, or `exit`), one
 * or more `data:` lines (joined with `\n`), and a blank-line terminator.
 * `exit` carries the exit code as a decimal string.
 */

export interface SSECallbacks {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export interface SSEResult {
  exitCode: number | null;
  sawExit: boolean;
}

/**
 * Consume the islo SSE stream and dispatch stdout/stderr deltas.
 * Resolves when the response body ends; returns the exit code emitted by the
 * final valid `exit` event and whether that event was observed.
 */
export async function consumeIsloStream(
  body: ReadableStream<Uint8Array>,
  callbacks: SSECallbacks = {},
): Promise<SSEResult> {
  const decoder = new TextDecoder('utf-8');
  const reader = body.getReader();
  let buffer = '';
  let exitCode: number | null = null;
  let sawExit = false;
  let event = '';
  let dataLines: string[] = [];

  const flush = () => {
    if (event === '' && dataLines.length === 0) {
      return;
    }
    const payload = dataLines.join('\n');
    switch (event) {
      case 'stdout':
        callbacks.onStdout?.(payload);
        break;
      case 'stderr':
        callbacks.onStderr?.(payload);
        break;
      case 'exit': {
        const parsed = Number.parseInt(payload.trim(), 10);
        if (Number.isFinite(parsed)) {
          exitCode = parsed;
          sawExit = true;
        }
        break;
      }
    }
    event = '';
    dataLines = [];
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        // Strip CR if present (CRLF line endings).
        let line = buffer.slice(0, nl);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        buffer = buffer.slice(nl + 1);
        processLine(line);
      }
    }
    // Drain any remaining buffer as a final line.
    buffer += decoder.decode();
    if (buffer.length > 0) {
      processLine(buffer);
    }
    flush();
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore release errors if reader is already done.
    }
  }

  return { exitCode, sawExit };

  function processLine(line: string): void {
    if (line === '') {
      flush();
      return;
    }
    if (line.startsWith(':')) {
      // SSE comment / keepalive
      return;
    }
    const colon = line.indexOf(':');
    let field: string;
    let value: string;
    if (colon === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, colon);
      value = line.slice(colon + 1);
      // Per SSE spec, a single leading space after the colon is stripped.
      if (value.startsWith(' ')) value = value.slice(1);
    }
    switch (field) {
      case 'event':
        event = value;
        break;
      case 'data':
        dataLines.push(value);
        break;
      case 'id':
      case 'retry':
        // Ignored.
        break;
    }
  }
}
