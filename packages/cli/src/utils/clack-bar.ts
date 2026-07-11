import pc from 'picocolors';

let _bar: string | undefined;
async function getBar(): Promise<string> {
  if (_bar === undefined) {
    const { S_BAR } = await import('@clack/prompts');
    _bar = pc.gray(S_BAR);
  }
  return _bar;
}

/** Write a line to stdout prefixed with the clack pipe for visual continuity. */
export async function writeBarLine(line: string): Promise<void> {
  const bar = await getBar();
  process.stdout.write(`${bar}  ${line}\n`);
}

/**
 * Wraps `process.stdout.write` so every line printed during `fn()` is
 * prefixed with the clack bar character, keeping streamed output visually
 * nested under the current clack step.
 */
export async function withBarPrefix<T>(fn: () => Promise<T>): Promise<T> {
  const originalWrite = process.stdout.write.bind(process.stdout);
  const prefix = await getBar();

  process.stdout.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
    const str = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
    const prefixed = str
      .split('\n')
      .map((line: string, i: number, arr: string[]) => {
        if (i === arr.length - 1 && line === '') return '';
        return `${prefix}  ${line}`;
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
