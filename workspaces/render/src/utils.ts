import { RenderSandboxError } from './errors.js';

export function quote(value: string): string {
  if (value.includes('\0')) throw new RenderSandboxError('CONFIGURATION', 'Shell values cannot contain NUL bytes');
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function positive(value: number, name: string, max = 2_147_483_647): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new RenderSandboxError('CONFIGURATION', `${name} must be an integer from 1 to ${max}`);
  }
  return value;
}

/** Bound a caller's wait even for SDK control-plane methods without signal support. */
export async function bounded<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    void promise.catch(() => {});
    signal.throwIfAborted();
  }
  let onAbort!: () => void;
  const canceled = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([promise, canceled]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

export function deadline(ms: number, signals: Array<AbortSignal | undefined> = []) {
  positive(ms, 'timeoutMs');
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new RenderSandboxError('TIMEOUT', 'Sandbox operation deadline exceeded')),
    ms,
  );
  return {
    signal: AbortSignal.any([controller.signal, ...signals.filter((s): s is AbortSignal => !!s)]),
    dispose: () => clearTimeout(timer),
  };
}

/** Keep a bounded UTF-8 tail, discarding a partial leading code point as well. */
export class OutputTail {
  private bytes = Buffer.alloc(0);
  dropped = 0;
  constructor(private readonly limit: number) {}
  push(chunk: string) {
    const incoming = Buffer.from(chunk);
    const combined = Buffer.concat([this.bytes, incoming]);
    let start = Math.max(0, combined.length - this.limit);
    while (start < combined.length && (combined[start]! & 0xc0) === 0x80) start++;
    this.dropped += start;
    this.bytes = Buffer.from(combined.subarray(start));
  }
  toString() {
    return this.bytes.toString('utf8');
  }
}
