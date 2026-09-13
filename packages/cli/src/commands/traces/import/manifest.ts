import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { PreparedTraceBatch, TraceImportManifest, TraceImportSourceIdentity, TraceImportWindow } from './types.js';

export const TRACE_IMPORT_SCHEMA_VERSION = 1;
export const TRACE_IMPORT_MANIFEST_FILE = 'manifest.json';
export const MAX_RECORDED_SOURCE_SPAN_IDS = 50;

const timestampSchema = z.string().datetime({ offset: true });
const countSchema = z.number().int().nonnegative();

const sourceIdentitySchema = z
  .object({
    provider: z.string().min(1),
    baseUrl: z.string().url(),
    projectId: z.string().min(1),
    idAlgorithmVersion: z.string().min(1),
  })
  .strict();

const skippedTraceSchema = z
  .object({
    sourceTraceId: z.string().nullable(),
    spanCount: countSchema,
    reason: z.string().min(1),
    detail: z.string().optional(),
    traceName: z.string().optional(),
    sourceSpanIds: z.array(z.string()).max(MAX_RECORDED_SOURCE_SPAN_IDS).optional(),
  })
  .strict();

const manifestSchema = z
  .object({
    schemaVersion: z.literal(TRACE_IMPORT_SCHEMA_VERSION),
    importId: z.string().uuid(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    source: sourceIdentitySchema,
    targetProjectId: z.string().min(1),
    window: z
      .object({
        cutoffAt: timestampSchema,
        snapshotAt: timestampSchema,
      })
      .strict()
      .refine(window => Date.parse(window.cutoffAt) < Date.parse(window.snapshotAt), 'Invalid import window.'),
    phase: z.enum(['preparing', 'prepared', 'uploading', 'complete']),
    counts: z.object({
      readSpans: countSchema,
      preparedTraces: countSchema,
      preparedSpans: countSchema,
      skippedTraces: countSchema,
      skippedSpans: countSchema,
      sourceRetries: countSchema,
      skipReasons: z.record(z.string(), countSchema),
    }),
    preparedBytes: countSchema,
    acknowledgedTraces: countSchema,
    acknowledgedSpans: countSchema,
    warnings: z.array(z.string()).max(50),
    skippedTraceSamples: z.array(skippedTraceSchema).max(50),
    completedAt: timestampSchema.optional(),
  })
  .strict()
  .superRefine((manifest, context) => {
    const recordedSkipReasons = Object.values(manifest.counts.skipReasons).reduce((total, count) => total + count, 0);
    if (
      manifest.counts.readSpans !== manifest.counts.preparedSpans + manifest.counts.skippedSpans ||
      recordedSkipReasons !== manifest.counts.skippedTraces
    ) {
      context.addIssue({ code: 'custom', message: 'Prepared and skipped counts do not match the source totals.' });
    }
    if (
      manifest.acknowledgedTraces > manifest.counts.preparedTraces ||
      manifest.acknowledgedSpans > manifest.counts.preparedSpans
    ) {
      context.addIssue({ code: 'custom', message: 'Acknowledged progress exceeds the prepared trace counts.' });
    }
    if (manifest.phase === 'preparing' && (manifest.acknowledgedTraces > 0 || manifest.acknowledgedSpans > 0)) {
      context.addIssue({ code: 'custom', message: 'A preparing import cannot contain acknowledged progress.' });
    }
    if (
      manifest.phase === 'complete' &&
      (manifest.acknowledgedTraces !== manifest.counts.preparedTraces ||
        manifest.acknowledgedSpans !== manifest.counts.preparedSpans ||
        !manifest.completedAt)
    ) {
      context.addIssue({ code: 'custom', message: 'A completed import must acknowledge every prepared trace.' });
    }
  });

function assertSafePathSegment(value: string, label: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`${label} may only contain letters, numbers, hyphens, and underscores.`);
  }
}

export function resolveTraceImportDirectory(options: {
  stateRoot?: string;
  targetProjectId: string;
  importId: string;
}): string {
  assertSafePathSegment(options.targetProjectId, 'Target project ID');
  assertSafePathSegment(options.importId, 'Import ID');
  return join(options.stateRoot ?? join(homedir(), '.mastra', 'imports'), options.targetProjectId, options.importId);
}

export async function initializeTraceImport(options: {
  stateRoot?: string;
  source: TraceImportSourceIdentity;
  targetProjectId: string;
  window: TraceImportWindow;
  importId?: string;
}): Promise<{ directory: string; manifest: TraceImportManifest }> {
  const importId = options.importId ?? randomUUID();
  const directory = resolveTraceImportDirectory({
    stateRoot: options.stateRoot,
    targetProjectId: options.targetProjectId,
    importId,
  });

  const now = new Date().toISOString();
  const manifest = manifestSchema.parse({
    schemaVersion: TRACE_IMPORT_SCHEMA_VERSION,
    importId,
    createdAt: now,
    updatedAt: now,
    source: options.source,
    targetProjectId: options.targetProjectId,
    window: options.window,
    phase: 'preparing',
    counts: {
      readSpans: 0,
      preparedTraces: 0,
      preparedSpans: 0,
      skippedTraces: 0,
      skippedSpans: 0,
      sourceRetries: 0,
      skipReasons: {},
    },
    preparedBytes: 0,
    acknowledgedTraces: 0,
    acknowledgedSpans: 0,
    warnings: [],
    skippedTraceSamples: [],
  }) as TraceImportManifest;

  await mkdir(directory, { recursive: true, mode: 0o700 });
  return { directory, manifest: await writeTraceImportManifest(directory, manifest) };
}

export async function readTraceImportManifest(directory: string): Promise<TraceImportManifest> {
  try {
    const value: unknown = JSON.parse(await readFile(join(directory, TRACE_IMPORT_MANIFEST_FILE), 'utf8'));
    return manifestSchema.parse(value) as TraceImportManifest;
  } catch (cause) {
    throw new Error(`Could not read a valid trace import manifest from ${directory}.`, { cause });
  }
}

/** Save a checkpoint with a temp-file rename, without checksums or fsync bookkeeping. */
export async function writeTraceImportManifest(
  directory: string,
  manifest: TraceImportManifest,
): Promise<TraceImportManifest> {
  const next = manifestSchema.parse({ ...manifest, updatedAt: new Date().toISOString() }) as TraceImportManifest;
  const temporaryFile = join(directory, `.manifest-${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryFile, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryFile, join(directory, TRACE_IMPORT_MANIFEST_FILE));
    return next;
  } finally {
    await rm(temporaryFile, { force: true });
  }
}

export function assertTraceImportResumeCompatible(
  manifest: TraceImportManifest,
  options: { source: TraceImportSourceIdentity; targetProjectId: string },
): void {
  if (manifest.targetProjectId !== options.targetProjectId) {
    throw new Error('Cannot resume because the target project changed.');
  }

  const sourceChanged =
    manifest.source.provider !== options.source.provider ||
    manifest.source.baseUrl !== options.source.baseUrl ||
    manifest.source.projectId !== options.source.projectId ||
    manifest.source.idAlgorithmVersion !== options.source.idAlgorithmVersion;
  if (sourceChanged) {
    throw new Error('Cannot resume because the source project or prepared ID strategy changed.');
  }
}

/** Persist progress only after the caller receives a successful upload acknowledgement. */
export async function acknowledgeTraceBatch(
  directory: string,
  batch: PreparedTraceBatch,
): Promise<TraceImportManifest> {
  const manifest = await readTraceImportManifest(directory);
  if (
    !batch.traces.length ||
    batch.spanCount !== batch.traces.reduce((total, trace) => total + trace.spans.length, 0)
  ) {
    throw new Error('Cannot acknowledge an empty or internally inconsistent trace batch.');
  }
  const endTraceIndex = batch.firstTraceIndex + batch.traces.length;

  if (manifest.acknowledgedTraces === endTraceIndex) return manifest;
  if (manifest.phase === 'preparing' || manifest.phase === 'complete') {
    throw new Error(`Cannot acknowledge a batch while the import is ${manifest.phase}.`);
  }
  if (manifest.acknowledgedTraces !== batch.firstTraceIndex) {
    throw new Error('Cannot acknowledge a batch that does not begin with the next pending trace.');
  }
  if (endTraceIndex > manifest.counts.preparedTraces) {
    throw new Error('Cannot acknowledge more traces than were prepared.');
  }

  return writeTraceImportManifest(directory, {
    ...manifest,
    phase: 'uploading',
    acknowledgedTraces: endTraceIndex,
    acknowledgedSpans: manifest.acknowledgedSpans + batch.spanCount,
  });
}
