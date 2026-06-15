import * as fs from 'node:fs';
import * as tty from 'node:tty';

/** Maximum piped input size (1 MB). Content beyond this is truncated. */
const MAX_PIPE_BYTES = 1024 * 1024;

/**
 * Matches all ANSI escape sequences — SGR (colors), cursor movement, line
 * clears, scrolling, window titles, etc.
 */
const ANSI_RE = /\x1b(?:\[[0-9;?]*[A-Za-z]|\][^\x07\x1b]*(?:\x07|\x1b\\)?|\([A-Z])/g;

/**
 * Clean up raw piped output so the agent sees readable text, not terminal
 * control noise.
 *
 * 1. Strip all ANSI escape sequences (colors, cursor movement, line clears).
 * 2. Simulate carriage-return overwrites: for each line, split on `\r` and
 *    keep only the last segment — this is what the terminal would display
 *    after a spinner/progress bar finishes.
 * 3. Collapse runs of blank lines.
 */
export function sanitizePipedOutput(raw: string): string {
  // Strip ANSI escapes first
  let text = raw.replace(ANSI_RE, '');

  // Strip binary control characters (everything below 0x20 except \t, \n, \r)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Simulate \r overwrites: for each line, the last \r-segment wins
  text = text
    .split('\n')
    .map(line => {
      if (!line.includes('\r')) return line;
      const segments = line.split('\r');
      // Walk backwards to find the last non-empty segment — a trailing \r
      // produces an empty final segment that would otherwise discard visible text.
      for (let i = segments.length - 1; i >= 0; i--) {
        if (segments[i]!.length > 0) return segments[i]!;
      }
      return '';
    })
    .join('\n');

  // Collapse 3+ consecutive blank lines into 2
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * If stdin is a pipe (not a TTY), read **all** data until EOF and return it as
 * a string. The returned promise only resolves once the write end of the pipe
 * is closed — i.e. the sending process has fully exited — so callers are
 * guaranteed to receive the complete output, not a partial snapshot from a
 * program that writes progressively.
 *
 * Returns `null` when:
 * - stdin is a TTY (interactive terminal)
 * - the pipe was empty or contained only whitespace
 */
export async function drainPipedStdin(): Promise<string | null> {
  if (process.stdin.isTTY) return null;

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  let truncated = false;

  for await (const chunk of process.stdin) {
    const buf = chunk as Buffer;

    if (totalBytes + buf.length > MAX_PIPE_BYTES) {
      // Take only what fits under the cap — copy so we don't retain the
      // original backing buffer, then zero the source.
      const remaining = MAX_PIPE_BYTES - totalBytes;
      if (remaining > 0) {
        chunks.push(Buffer.from(buf.subarray(0, remaining)));
      }
      buf.fill(0);
      totalBytes = MAX_PIPE_BYTES;
      truncated = true;
      // Keep draining so we don't leave unread data in the pipe, but don't
      // store it — we still need to wait for EOF.
      continue;
    }

    chunks.push(buf);
    totalBytes += buf.length;
  }

  if (truncated) {
    process.stderr.write(`Warning: Piped input exceeded ${MAX_PIPE_BYTES / 1024 / 1024}MB and was truncated.\n`);
  }

  const raw = Buffer.concat(chunks).toString('utf-8');

  // Zero out raw buffers so piped secrets don't linger in memory
  for (const buf of chunks) {
    buf.fill(0);
  }
  chunks.length = 0;

  const content = sanitizePipedOutput(raw);
  return content.length > 0 ? content : null;
}

/**
 * Reopen `/dev/tty` (or `CON` on Windows) as `process.stdin` so that the
 * interactive TUI can read keyboard input after the original piped stdin has
 * been consumed.
 *
 * @returns `true` if the swap succeeded, `false` if a TTY could not be opened
 * (e.g. running in a headless CI container with no controlling terminal).
 */
export function reopenStdinFromTTY(): boolean {
  const ttyPath = process.platform === 'win32' ? 'CON' : '/dev/tty';

  let fd: number;
  try {
    fd = fs.openSync(ttyPath, 'r');
  } catch {
    return false;
  }

  const ttyStream = new tty.ReadStream(fd);

  Object.defineProperty(process, 'stdin', {
    value: ttyStream,
    writable: true,
    configurable: true,
  });

  return true;
}
