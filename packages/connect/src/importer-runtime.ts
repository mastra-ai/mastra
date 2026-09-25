import { createHash } from 'node:crypto';
import type { KnowledgeImporterCronTrigger, KnowledgeImporterState } from '@mastra/core/knowledge';
import { z } from 'zod';

import type { ImporterProviderContext } from './importer-registry.js';

/** Maximum records processed per handler invocation. Bounded runs are a hard invariant. */
export const DEFAULT_MAX_RECORDS_PER_RUN = 500;
/** Maximum HTTP pages walked per handler invocation. Prevents runaway pagination. */
export const DEFAULT_MAX_PAGES_PER_RUN = 50;
/** Maximum characters stored in a single record text body. Mirrors Tyler's shipyard importer. */
export const MAX_RECORD_TEXT = 8000;

/**
 * Whether a scope address is a core access pattern — it contains a
 * `$parameter` segment per core's grammar (`$` followed by a letter). Pattern
 * keys grant authority over the scopes they match but are not destinations.
 */
export function isParameterizedScope(scope: string): boolean {
  return /\$[A-Za-z]/.test(scope);
}

/**
 * Builds the cron trigger every catalogue provider shares. Concrete `access`
 * keys become static bindings (today's behavior, unchanged); parameterized
 * keys are authority patterns, not destinations, and are excluded. When the
 * host configured dynamic `scopes`, they surface as the trigger's
 * `resolveBindings` — resolved at each fire (with the importer's connection
 * as context, enabling per-connection routing) and unioned with the static
 * set by the core runner.
 */
export function importerCronTrigger(
  source: string,
  ctx: Pick<ImporterProviderContext, 'access' | 'schedule' | 'scopes' | 'connection'>,
): KnowledgeImporterCronTrigger {
  const staticBindings = Object.keys(ctx.access)
    .filter(scope => !isParameterizedScope(scope))
    .map(scope => ({ source, scope }));
  const { scopes, connection } = ctx;
  return {
    schedule: ctx.schedule,
    ...(staticBindings.length > 0 ? { bindings: staticBindings } : {}),
    ...(scopes
      ? { resolveBindings: async () => (await scopes({ connection })).map(scope => ({ source, scope })) }
      : {}),
  };
}

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

const highWaterSchema = z.object({ highWater: z.string() });

/**
 * Reads the persisted high-water candidate for a descending-walk backfill in progress.
 * Descending walkers observe the newest timestamp on their first-fetched page; on a
 * multi-run backfill the drain run only sees older items via its resume cursor and would
 * otherwise regress the watermark. Persisting the high-water across runs lets the drain
 * write the true newest value.
 */
export async function readHighWater(state: KnowledgeImporterState, key: string): Promise<string | undefined> {
  const raw = await state.get(key);
  if (raw === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Knowledge importer state '${key}' is not valid JSON`);
  }
  const value = highWaterSchema.parse(parsed).highWater;
  return value === '' ? undefined : value;
}

/** Persist the running high-water candidate. Callers write during multi-run backfill. */
export async function writeHighWater(state: KnowledgeImporterState, key: string, highWater: string): Promise<void> {
  await state.set(key, JSON.stringify({ highWater }));
}

/** Mark the high-water as cleared. Empty sentinel, treated as unset by `readHighWater`. */
export async function clearHighWater(state: KnowledgeImporterState, key: string): Promise<void> {
  await state.set(key, JSON.stringify({ highWater: '' }));
}

/**
 * A relationship a record asserts toward another node, stored as record
 * metadata (`{ links: RecordLink[] }`) and resolved to graph edges at render
 * time by the Factory graph route. `address` is the preferred handle — the
 * target's stable node address, resolved against the window's node
 * `metadata.address` map. `name` is the display-name fallback for sources that
 * only expose titles (Confluence title-links), resolved via the wikilink name
 * resolver. `rel` is free-form ('references' | 'child-of' | 'in' | ...) and
 * render-neutral in v1.
 */
export interface RecordLink {
  readonly address?: string;
  readonly name?: string;
  readonly rel?: string;
}

/**
 * Normalizes a link set into record metadata: drops entries with neither
 * address nor name, dedups, and sorts deterministically (by `address ?? name`,
 * then `rel`) so the array is stable for content hashing. Returns `{}` for an
 * empty result so records without links carry no `links` key.
 *
 * NOTE: record metadata is NOT hashed by `contentRecordId` — providers must
 * add the returned sorted array to their hash payload explicitly.
 */
export function linksMetadata(links: readonly RecordLink[]): { links?: RecordLink[] } {
  const seen = new Set<string>();
  const cleaned: RecordLink[] = [];
  for (const link of links) {
    const address = link.address?.trim() || undefined;
    const name = link.name?.trim() || undefined;
    if (!address && !name) continue;
    const key = `${address ?? ''}\u0000${name ?? ''}\u0000${link.rel ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({
      ...(address ? { address } : {}),
      ...(name ? { name } : {}),
      ...(link.rel ? { rel: link.rel } : {}),
    });
  }
  cleaned.sort((a, b) => {
    const ka = a.address ?? a.name ?? '';
    const kb = b.address ?? b.name ?? '';
    if (ka !== kb) return ka < kb ? -1 : 1;
    const ra = a.rel ?? '';
    const rb = b.rel ?? '';
    return ra < rb ? -1 : ra > rb ? 1 : 0;
  });
  return cleaned.length > 0 ? { links: cleaned } : {};
}

/**
 * Node self-identification metadata. The graph route resolves `RecordLink`
 * addresses against the window's nodes keyed on this metadata — every importer
 * stamps it at upsert time. `aliases` covers alternative address forms links
 * may arrive in (e.g. Linear doc slug URLs).
 */
export function nodeSelfMetadata(
  address: string,
  aliases?: readonly string[],
): { address: string; addressAliases?: string[] } {
  return aliases && aliases.length > 0 ? { address, addressAliases: [...aliases] } : { address };
}

/**
 * Replaces wikilink brackets in imported body text with fullwidth lookalikes
 * (`[[` → `［［`, `]]` → `］］`) so source content can never mint name-resolved
 * edges through the graph route's wikilink parser. Relationships from
 * importers travel exclusively through `RecordLink` metadata.
 */
export function neutralizeWikilinks(text: string): string {
  return text.replaceAll('[[', '［［').replaceAll(']]', '］］');
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
