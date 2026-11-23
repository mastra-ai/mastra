import { S_BAR } from '@clack/prompts';
import pc from 'picocolors';

import { createDeployLogWriter } from './deploy-log-format.js';
import type { DeployLogWriter, DeployLogWriterOptions } from './deploy-log-format.js';

let _bar: string | undefined;
function getBar(): string {
  _bar ??= pc.gray(S_BAR);
  return _bar;
}

/** Write a line to stdout prefixed with the clack pipe for visual continuity. */
export async function writeBarLine(line: string): Promise<void> {
  process.stdout.write(`${getBar()}  ${line}\n`);
}

/**
 * Deploy log writer whose lines are nested under the current clack step.
 * See {@link createDeployLogWriter} for the formatting and tail behaviour.
 */
export function createBarLogWriter(options: Omit<DeployLogWriterOptions, 'prefix'> = {}): DeployLogWriter {
  return createDeployLogWriter({ ...options, prefix: `${getBar()}  ` });
}

/**
 * Wraps `process.stdout.write` so every line printed during `fn()` is
 * prefixed with the clack bar character, keeping streamed output visually
 * nested under the current clack step.
 */
export async function withBarPrefix<T>(fn: () => Promise<T>): Promise<T> {
  const originalWrite = process.stdout.write.bind(process.stdout);
  const prefix = getBar();

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
