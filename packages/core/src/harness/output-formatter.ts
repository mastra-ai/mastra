import type { Writable } from 'node:stream';
import type { MastraModelOutput, FullOutput } from '../stream/base/output';
import type { ChunkType } from '../stream/types';

/**
 * Output format options for headless mode.
 */
export type OutputFormat = 'text' | 'json' | 'stream-json';

/**
 * JSON.stringify replacer that renders Error instances as plain objects
 * (Error's properties aren't enumerable by default).
 */
function errorReplacer(_key: string, value: unknown) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

/**
 * Format output in `text` mode: stream text-delta payloads to stdout,
 * warnings/errors to stderr.
 */
export async function formatText<OUTPUT>(
  streamOutput: MastraModelOutput<OUTPUT>,
  stdout: Writable,
  stderr: Writable,
): Promise<FullOutput<OUTPUT>> {
  const reader = streamOutput.fullStream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = value as ChunkType<OUTPUT>;
      if (chunk.type === 'text-delta') {
        stdout.write((chunk.payload as { text: string }).text);
      } else if (chunk.type === 'error') {
        stderr.write(`Error: ${String((chunk.payload as { error: unknown }).error)}\n`);
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Trailing newline for clean terminal output
  stdout.write('\n');

  return streamOutput.getFullOutput();
}

/**
 * Format output in `json` mode: await completion, emit the FullOutput as a single JSON line to stdout.
 */
export async function formatJson<OUTPUT>(
  streamOutput: MastraModelOutput<OUTPUT>,
  stdout: Writable,
  _startTime: number,
): Promise<FullOutput<OUTPUT>> {
  const fullOutput = await streamOutput.getFullOutput();
  stdout.write(JSON.stringify(fullOutput, errorReplacer) + '\n');
  return fullOutput;
}

/**
 * Format output in `stream-json` mode: emit each ChunkType as an NDJSON line to stdout.
 */
export async function formatStreamJson<OUTPUT>(
  streamOutput: MastraModelOutput<OUTPUT>,
  stdout: Writable,
  _stderr: Writable,
): Promise<FullOutput<OUTPUT>> {
  const reader = streamOutput.fullStream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      stdout.write(JSON.stringify(value) + '\n');
    }
  } finally {
    reader.releaseLock();
  }

  return streamOutput.getFullOutput();
}

/**
 * Determine if a FullOutput has warnings, for --strict exit code logic.
 */
export function hasWarnings<OUTPUT>(fullOutput: FullOutput<OUTPUT>): boolean {
  return fullOutput.warnings.length > 0;
}
