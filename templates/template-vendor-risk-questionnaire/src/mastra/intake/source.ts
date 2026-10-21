import { createHash } from 'node:crypto';
import { open, realpath, lstat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, basename } from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { limitsSchema } from '../contracts/limits.ts';
import type { InputLimits } from '../contracts/limits.ts';
import type { Diagnostic } from '../contracts/diagnostic.ts';
import { resolveProjectRoot } from '../runtime/paths.ts';

export interface InputSourceSnapshot {
  sourceId: string;
  originalName: string;
  sizeBytes: number;
  sha256: string;
  bytes: Uint8Array;
  mediaType?: string;
}
export interface InputAdapterContext {
  limits: InputLimits;
  signal: AbortSignal;
}
export const sha256 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export class IntakeFailure extends Error {
  code: Diagnostic['code'];
  sourceId: string;
  constructor(code: Diagnostic['code'], sourceId: string) {
    super(code);
    this.code = code;
    this.sourceId = sourceId;
  }
}
export function diagnostic(error: unknown, sourceId: string): Diagnostic {
  return {
    code: error instanceof IntakeFailure ? error.code : 'PARSER_FAILED',
    severity: 'error',
    sourceId,
    message: 'Input could not be accepted safely.',
    action: 'Check the format, confirmed mapping and configured limits, then retry.',
  };
}
export async function readSource(
  path: string,
  sourceId: string,
  limits: InputLimits,
  root?: string,
): Promise<InputSourceSnapshot> {
  limitsSchema.parse(limits);
  try {
    let p = resolve(path);
    if (root) {
      const base = await realpath(root);
      p = resolve(base, path);
      const rel = relative(base, p);
      if (isAbsolute(rel) || rel.startsWith('..')) throw new IntakeFailure('READ_FAILED', sourceId);
      let component = base;
      for (const segment of rel.split('/')) {
        component = resolve(component, segment);
        if ((await lstat(component)).isSymbolicLink()) throw new IntakeFailure('READ_FAILED', sourceId);
      }
      const actual = await realpath(p);
      if (relative(base, actual).startsWith('..')) throw new IntakeFailure('READ_FAILED', sourceId);
    }
    const f = await open(p, 'r');
    try {
      const st = await f.stat();
      if (!st.isFile()) throw new IntakeFailure('READ_FAILED', sourceId);
      if (st.size > limits.maxBytes) throw new IntakeFailure('LIMIT_EXCEEDED', sourceId);
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of f.createReadStream({ autoClose: false, highWaterMark: 65536 })) {
        total += chunk.length;
        if (total > limits.maxBytes) throw new IntakeFailure('LIMIT_EXCEEDED', sourceId);
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      if (bytes.length > limits.maxBytes) throw new IntakeFailure('LIMIT_EXCEEDED', sourceId);
      return { sourceId, originalName: basename(p), sizeBytes: bytes.length, sha256: sha256(bytes), bytes };
    } finally {
      await f.close();
    }
  } catch (e) {
    if (e instanceof IntakeFailure) throw e;
    throw new IntakeFailure('READ_FAILED', sourceId);
  }
}
export async function runParser<T>(
  source: InputSourceSnapshot,
  format: string,
  mode: 'questionnaire' | 'evidence',
  context: InputAdapterContext,
): Promise<T> {
  const limits = limitsSchema.parse(context.limits);
  if (context.signal.aborted) throw new IntakeFailure('CANCELLED', source.sourceId);
  if (source.sizeBytes !== source.bytes.length || source.sha256 !== sha256(source.bytes))
    throw new IntakeFailure('SOURCE_CHANGED', source.sourceId);
  if (source.bytes.length > limits.maxBytes) throw new IntakeFailure('LIMIT_EXCEEDED', source.sourceId);
  // Native TypeScript workers remain separate from the Mastra bundle, allowing hard termination.
  const sourceWorker = new URL('./parser-worker.ts', import.meta.url);
  const workerPath = fileURLToPath(sourceWorker).includes('/.mastra/')
    ? resolve(resolveProjectRoot(), 'src/mastra/intake/parser-worker.ts')
    : sourceWorker;
  return new Promise<T>((accept, reject) => {
    const worker = new Worker(workerPath, {
      workerData: { bytes: source.bytes, format, mode, limits },
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32 },
    });
    let done = false;
    const finish = (error?: IntakeFailure, result?: T) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      context.signal.removeEventListener('abort', abort);
      void worker.terminate();
      if (error) reject(error);
      else accept(result!);
    };
    const abort = () => finish(new IntakeFailure('CANCELLED', source.sourceId));
    const timer = setTimeout(() => finish(new IntakeFailure('LIMIT_EXCEEDED', source.sourceId)), limits.timeoutMs);
    context.signal.addEventListener('abort', abort, { once: true });
    worker.once('message', (m: { code?: Diagnostic['code']; result: T }) =>
      finish(m.code ? new IntakeFailure(m.code, source.sourceId) : undefined, m.result),
    );
    worker.once('error', () => finish(new IntakeFailure('PARSER_FAILED', source.sourceId)));
    worker.once('exit', code => {
      if (!done) finish(new IntakeFailure(code === 0 ? 'PARSER_FAILED' : 'LIMIT_EXCEEDED', source.sourceId));
    });
    if (context.signal.aborted) abort();
  });
}

export async function readJson(path: string, sourceId: string, maxBytes = 1024 * 1024): Promise<unknown> {
  const source = await readSource(path, sourceId, limitsSchema.parse({ maxBytes }));
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(source.bytes));
  } catch {
    throw new IntakeFailure('INVALID_MAPPING', sourceId);
  }
}
