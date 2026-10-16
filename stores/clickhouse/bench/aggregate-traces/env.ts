/**
 * Credential loading, host guard and output redaction for the benchmark harness.
 *
 * Credentials are parsed from the env file in memory (`util.parseEnv`) and never placed in
 * `process.env`, so child processes cannot inherit them. Every byte written to stdout/stderr
 * passes through the redactor once `installOutputRedaction()` has run.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

export const ALLOWED_HOST = 'gyiixsk9we.us-central1.gcp.clickhouse.cloud';
export const ALLOWED_PORT = '8443';
/** Production's primary service. Any URL mentioning it is refused outright. */
export const DENIED_MARKER = 'ijwqa4hihv';
export const ENV_FILE = join(homedir(), '.config/aqa-bench/clickhouse.env');
export const CACHE_DIR = join(homedir(), '.cache/aqa-bench');
export const SELECTION_FILE = join(CACHE_DIR, 'selection.json');

export interface BenchCredentials {
  /** `https://<allowed host>:8443`, without userinfo or path. */
  origin: string;
  username: string;
  password: string;
  database?: string;
}

export class GuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuardError';
  }
}

/** Validates the configured URL and returns the bare origin the client may use. Never echoes the input. */
export function guardUrl(raw: string): string {
  if (raw.toLowerCase().includes(DENIED_MARKER)) {
    throw new GuardError('Refusing to run: the URL points at the production primary service');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new GuardError('Refusing to run: BENCH_CLICKHOUSE_URL is not a valid URL');
  }
  if (url.protocol !== 'https:') throw new GuardError('Refusing to run: BENCH_CLICKHOUSE_URL must use https');
  if (url.hostname !== ALLOWED_HOST) {
    throw new GuardError('Refusing to run: BENCH_CLICKHOUSE_URL host is not the approved read-only service');
  }
  if (url.port !== ALLOWED_PORT)
    throw new GuardError(`Refusing to run: BENCH_CLICKHOUSE_URL port must be ${ALLOWED_PORT}`);
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new GuardError('Refusing to run: BENCH_CLICKHOUSE_URL must not contain a path');
  }
  return `https://${ALLOWED_HOST}:${ALLOWED_PORT}`;
}

/** Parses env-file content into guarded credentials. Exported for tests. */
export function credentialsFromEnv(env: Record<string, string | undefined>): BenchCredentials {
  const url = env.BENCH_CLICKHOUSE_URL;
  const username = env.BENCH_CLICKHOUSE_USER;
  const password = env.BENCH_CLICKHOUSE_PASSWORD;
  if (!url || !username || !password) {
    throw new GuardError(
      'BENCH_CLICKHOUSE_URL, BENCH_CLICKHOUSE_USER and BENCH_CLICKHOUSE_PASSWORD must all be set in the env file',
    );
  }
  const origin = guardUrl(url);
  // Userinfo in the URL is ignored; the credentials are passed separately.
  const database = env.BENCH_CLICKHOUSE_DATABASE || undefined;
  if (database !== undefined && !/^[A-Za-z0-9_]+$/.test(database)) {
    throw new GuardError('BENCH_CLICKHOUSE_DATABASE must be a plain identifier');
  }
  return { origin, username, password, database };
}

/** Raw env-file values, for the leak check only. */
export function readEnvFileValues(): Record<string, string> {
  if (!existsSync(ENV_FILE)) throw new GuardError(`Credentials file not found: ${ENV_FILE}`);
  return parseEnv(readFileSync(ENV_FILE, 'utf8')) as Record<string, string>;
}

export function loadCredentials(): BenchCredentials {
  const values = readEnvFileValues();
  const credentials = credentialsFromEnv(values);
  registerSensitive([values.BENCH_CLICKHOUSE_URL, credentials.username, credentials.password]);
  return credentials;
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

const REDACTED = '[REDACTED]';
const sensitive = new Set<string>();

/** Adds values that must never reach the terminal or any file. Short values are ignored to avoid shredding output. */
export function registerSensitive(values: Iterable<string | undefined | null>): void {
  for (const value of values) {
    if (!value || value.length < 4) continue;
    sensitive.add(value);
    const encoded = encodeURIComponent(value);
    if (encoded !== value) sensitive.add(encoded);
  }
}

export function redact(text: string): string {
  let out = text.replace(/\/\/[^/\s@]+@/g, `//${REDACTED}@`);
  // Longest first so a secret containing another is fully replaced.
  for (const value of [...sensitive].sort((a, b) => b.length - a.length)) {
    if (out.includes(value)) out = out.split(value).join(REDACTED);
  }
  return out;
}

export function resetSensitiveForTests(): void {
  sensitive.clear();
}

let installed = false;

/** Routes every stdout/stderr write through `redact()` and redacts uncaught errors. */
export function installOutputRedaction(): void {
  if (installed) return;
  installed = true;
  for (const stream of [process.stdout, process.stderr]) {
    const write = stream.write.bind(stream) as (chunk: unknown, ...rest: unknown[]) => boolean;
    stream.write = ((chunk: unknown, ...rest: unknown[]) => {
      const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      return write(redact(text), ...rest);
    }) as typeof stream.write;
  }
  const fail = (label: string) => (error: unknown) => {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    process.stderr.write(`${label}: ${message}\n`);
    process.exit(1);
  };
  process.on('uncaughtException', fail('Uncaught exception'));
  process.on('unhandledRejection', fail('Unhandled rejection'));
}
