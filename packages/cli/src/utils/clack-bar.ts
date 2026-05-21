import { styleText } from 'node:util';

const isUnicodeSupported =
  process.platform !== 'win32' ? process.env.TERM !== 'linux' : Boolean(process.env.CI || process.env.WT_SESSION);

const barChar = isUnicodeSupported ? '\u2502' : '|';
const bar = styleText('gray', barChar);

/** Write a line to stdout prefixed with the clack pipe for visual continuity. */
export function writeBarLine(line: string): void {
  process.stdout.write(`${bar}  ${line}\n`);
}

/**
 * Wraps `process.stdout.write` so every line printed during `fn()` is
 * prefixed with the clack bar character, keeping streamed output visually
 * nested under the current clack step.
 */
export async function withBarPrefix<T>(fn: () => Promise<T>): Promise<T> {
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
    const str = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
    const prefixed = str
      .split('\n')
      .map((line: string, i: number, arr: string[]) => {
        if (i === arr.length - 1 && line === '') return '';
        return `${bar}  ${line}`;
      })
      .join('\n');
    return originalWrite(prefixed, ...(args as []));
  }) as typeof process.stdout.write;

  try {
    return await fn();
  } finally {
    process.stdout.write = originalWrite;
  }
}
