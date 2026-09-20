import { createHash } from 'node:crypto';
import type { KnowledgeImporterState } from '@mastra/core/knowledge';
import { z } from 'zod';

/** Maximum records processed per handler invocation. Bounded runs are a hard invariant. */
export const DEFAULT_MAX_RECORDS_PER_RUN = 500;
/** Maximum HTTP pages walked per handler invocation. Prevents runaway pagination. */
export const DEFAULT_MAX_PAGES_PER_RUN = 50;
/** Maximum characters stored in a single record text body. Mirrors Tyler's shipyard importer. */
export const MAX_RECORD_TEXT = 8000;

const watermarkSchema = z.object({ watermark: z.string() });

/**
 * Reads a JSON-encoded watermark from the importer's durable state. Returns
 * `undefined` when unset. Malformed persisted state throws — the run fails and
 * a later run recovers from the previous good watermark.
 */
export async function readWatermark(state: KnowledgeImporterState, key: string): Promise<string | undefined> {
  const raw = await state.get(key);
  if (raw === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Knowledge importer state '${key}' is not valid JSON`);
  }
  return watermarkSchema.parse(parsed).watermark;
}

/** Writes the watermark as JSON. Callers commit exactly once per run, after all mutations. */
export async function writeWatermark(state: KnowledgeImporterState, key: string, watermark: string): Promise<void> {
  await state.set(key, JSON.stringify({ watermark }));
}

const resumeCursorSchema = z.object({ cursor: z.string() });

/**
 * Reads a durable pagination resume cursor written by a descending walker that
 * truncated on a bound. Returns `undefined` when unset (initial run, or the
 * previous run drained fully and cleared the cursor). An empty stored cursor
 * (persisted by `clearResumeCursor`) is treated as unset.
 */
export async function readResumeCursor(state: KnowledgeImporterState, key: string): Promise<string | undefined> {
  const raw = await state.get(key);
  if (raw === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Knowledge importer state '${key}' is not valid JSON`);
  }
  const cursor = resumeCursorSchema.parse(parsed).cursor;
  return cursor === '' ? undefined : cursor;
}

/** Persist a pagination resume cursor. Callers write when a DESC walk truncates on a bound. */
export async function writeResumeCursor(state: KnowledgeImporterState, key: string, cursor: string): Promise<void> {
  await state.set(key, JSON.stringify({ cursor }));
}

/**
 * Mark the resume cursor as cleared. The state key is set to an empty cursor
 * (the `KnowledgeImporterState` contract has no `delete`), which `readResumeCursor`
 * treats as unset.
 */
export async function clearResumeCursor(state: KnowledgeImporterState, key: string): Promise<void> {
  await state.set(key, JSON.stringify({ cursor: '' }));
}

/**
 * Deterministic UUID-shaped record id derived from arbitrary content. Two calls
 * with the same content produce the same id, so idempotent appends dedupe
 * naturally. Copy of Tyler's shipyard importer pattern (sha256 → RFC-4122 shape).
 */
export function contentRecordId(content: unknown): string {
  const hash = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/** Truncate free-form provider text to the record size limit. Preserves the leading portion. */
export function boundText(text: string, max = MAX_RECORD_TEXT): string {
  if (text.length <= max) return text;
  return text.slice(0, max);
}

export interface PagedRunLimits {
  readonly maxRecords?: number;
  readonly maxPages?: number;
  readonly signal: AbortSignal;
}

export interface PagedRunControl<TPage> {
  readonly page: TPage;
  readonly recordsProcessed: number;
}

export interface PagedRunResult {
  /** `true` iff `fetchPage` returned `undefined` — i.e. the source signalled no more pages. */
  readonly exhausted: boolean;
  /** Total records the caller reported processed across all pages. */
  readonly recordsProcessed: number;
}

/**
 * Bounded pagination helper. `fetchPage` is called until it returns `undefined`
 * (no more pages), the abort signal fires, `maxPages` is hit, or `handle` reports
 * that the caller-tracked record count has reached `maxRecords`. Callers advance
 * their own record counter — the helper only enforces the bounds. The returned
 * `exhausted` flag lets callers distinguish "reached end of source" from "hit a
 * bound" — critical for watermark discipline on descending walks.
 */
export async function walkPages<TPage>(
  limits: PagedRunLimits,
  fetchPage: (pageIndex: number) => Promise<TPage | undefined>,
  handle: (control: PagedRunControl<TPage>) => Promise<number>,
): Promise<PagedRunResult> {
  const maxPages = limits.maxPages ?? DEFAULT_MAX_PAGES_PER_RUN;
  const maxRecords = limits.maxRecords ?? DEFAULT_MAX_RECORDS_PER_RUN;
  let recordsProcessed = 0;
  for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
    if (limits.signal.aborted) return { exhausted: false, recordsProcessed };
    const page = await fetchPage(pageIndex);
    if (page === undefined) return { exhausted: true, recordsProcessed };
    recordsProcessed = await handle({ page, recordsProcessed });
    if (recordsProcessed >= maxRecords) return { exhausted: false, recordsProcessed };
  }
  return { exhausted: false, recordsProcessed };
}
