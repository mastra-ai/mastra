/**
 * Code Mode — shared console-log collector
 *
 * A bounded, transport-neutral collector for captured console output. Every
 * built-in transport (stdio, QuickJS, isolated-vm) captures lines through this
 * helper so truncation behaves identically everywhere, and each transport's
 * in-memory buffer stays bounded while guest code is still running.
 *
 * Semantics:
 * - Lines are appended in order.
 * - `maxLogLines` and `maxLogBytes` are optional; omitted means unlimited.
 * - On overflow the logs are **truncated**, never failed: the collector keeps
 *   the longest allowed prefix and appends one deterministic marker line.
 * - The marker itself counts toward both caps, so the returned logs always fit.
 * - `maxLogLines: 0` or `maxLogBytes: 0` captures nothing.
 * - Every retained line costs at least one byte, so a byte cap also bounds the
 *   number of retained lines: empty lines are not free, and a chatty program
 *   cannot grow the buffer without limit by logging empty strings.
 *
 * Only Web-standard APIs are used, so it works in Node and in hosted runtimes.
 */

/** Marker appended once when log capture hit a cap. Counts toward both caps. */
const TRUNCATION_MARKER = '[code mode logs truncated]';

export interface CodeModeLogCollectorOptions {
  /**
   * Maximum UTF-8 bytes across all captured lines. Each line costs at least one
   * byte, so this also caps the number of retained lines. `0` captures nothing;
   * omitted means unlimited.
   */
  maxLogBytes?: number;
  /**
   * Maximum number of captured lines. `0` captures nothing; omitted means
   * unlimited.
   */
  maxLogLines?: number;
}

export interface CodeModeLogCollector {
  /** Append one formatted console line, truncating if a cap would be exceeded. */
  push(message: string): void;
  /**
   * The captured lines, with the truncation marker appended when overflow
   * occurred. Idempotent: calling it more than once returns the same result.
   */
  logs(): string[];
}

const encoder = new TextEncoder();

/** UTF-8 byte length of a string. */
function utf8Length(value: string): number {
  return encoder.encode(value).length;
}

/**
 * Create a bounded log collector. Pass the two optional caps straight through
 * from the transport's run options.
 */
export function createCodeModeLogCollector(options: CodeModeLogCollectorOptions = {}): CodeModeLogCollector {
  const maxLines = options.maxLogLines ?? Number.POSITIVE_INFINITY;
  const maxBytes = options.maxLogBytes ?? Number.POSITIVE_INFINITY;
  const markerBytes = utf8Length(TRUNCATION_MARKER);

  const kept: Array<{ text: string; bytes: number }> = [];
  let keptBytes = 0;
  let truncated = false;

  return {
    push(message) {
      if (truncated) return;
      // Each line costs at least one byte: otherwise empty messages would be
      // free, `maxLogBytes: 0` would still retain them, and a finite byte cap
      // would not bound the number of retained entries.
      const bytes = Math.max(1, utf8Length(message));
      if (kept.length + 1 > maxLines || keptBytes + bytes > maxBytes) {
        truncated = true;
        return;
      }
      kept.push({ text: message, bytes });
      keptBytes += bytes;
    },
    logs() {
      if (!truncated) return kept.map(entry => entry.text);
      // Make room for the marker, which itself counts toward both caps: drop
      // trailing kept lines until the marker fits within the remaining budget.
      const out = kept.slice();
      let bytes = keptBytes;
      while (out.length + 1 > maxLines || bytes + markerBytes > maxBytes) {
        if (out.length === 0) return [];
        const dropped = out.pop();
        if (dropped === undefined) return [];
        bytes -= dropped.bytes;
      }
      return [...out.map(entry => entry.text), TRUNCATION_MARKER];
    },
  };
}
