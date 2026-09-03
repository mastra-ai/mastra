import { randomUUID } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import {
  TRACE_IMPORT_FIELDS,
  TRACE_IMPORT_ID_ALGORITHM_VERSION,
  TRACE_IMPORT_MAPPER_VERSION,
  TRACE_IMPORT_SCHEMA_VERSION,
  TRACE_IMPORT_SHARD_COUNT,
  type TraceImportManifest,
} from './types.js';

const batchSchema = z.object({
  index: z.number().int().nonnegative(),
  file: z.string().regex(/^\d{6,}\.json$/),
  spanCount: z.number().int().nonnegative(),
  byteLength: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  status: z.enum(['pending', 'acknowledged']),
  attempts: z.number().int().nonnegative(),
  acknowledgedAt: z.string().datetime({ offset: true }).optional(),
});

const countsSchema = z.object({
  readSpans: z.number().int().nonnegative(),
  eligibleTraces: z.number().int().nonnegative(),
  eligibleSpans: z.number().int().nonnegative(),
  skippedTraces: z.number().int().nonnegative(),
  skippedSpans: z.number().int().nonnegative(),
  enqueuedSpans: z.number().int().nonnegative(),
  verifiedTraces: z.number().int().nonnegative(),
  truncationRiskSpans: z.number().int().nonnegative(),
  sourceRetries: z.number().int().nonnegative(),
  targetRetries: z.number().int().nonnegative(),
  skipReasons: z.record(z.string(), z.number().int().nonnegative()),
});

const manifestSchema = z.object({
  schemaVersion: z.literal(TRACE_IMPORT_SCHEMA_VERSION),
  mapperVersion: z.literal(TRACE_IMPORT_MAPPER_VERSION),
  idAlgorithmVersion: z.literal(TRACE_IMPORT_ID_ALGORITHM_VERSION),
  shardCount: z.literal(TRACE_IMPORT_SHARD_COUNT),
  importId: z.string().uuid(),
  provider: z.literal('langfuse'),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  snapshotAt: z.string().datetime({ offset: true }),
  cutoffAt: z.string().datetime({ offset: true }),
  fields: z.literal(TRACE_IMPORT_FIELDS),
  source: z.object({
    baseUrl: z.string().url(),
    projectId: z.string().min(1).optional(),
    cursor: z.string().min(1).optional(),
    complete: z.boolean(),
    pageCount: z.number().int().nonnegative(),
    observationCount: z.number().int().nonnegative(),
    spoolBytes: z.number().int().nonnegative(),
    unknownObservationTypes: z.array(z.string().min(1)),
  }),
  target: z.object({
    projectId: z.string().min(1),
    collectorOrigin: z.string().url(),
    environment: z.string().min(1).optional(),
    warnings: z.array(
      z.object({
        code: z.string(),
        message: z.string(),
        count: z.number().int().nonnegative().optional(),
      }),
    ),
  }),
  phase: z.enum(['reading', 'planned', 'uploading', 'complete', 'paused']),
  counts: countsSchema,
  estimatedPayloadBytes: z.number().int().nonnegative(),
  batches: z.array(batchSchema),
  verification: z.object({
    status: z.enum(['not-performed', 'verified', 'partial', 'timed-out', 'unavailable']),
    reason: z.string().min(1).optional(),
    sampledTraces: z.number().int().nonnegative(),
    verifiedTraces: z.number().int().nonnegative(),
    attempts: z.number().int().nonnegative(),
    samples: z.array(
      z.object({
        traceId: z.string().min(1),
        spanIds: z.array(z.string().min(1)),
      }),
    ),
  }),
  lastError: z
    .object({
      stage: z.enum(['source', 'target']),
      message: z.string(),
      at: z.string().datetime({ offset: true }),
    })
    .optional(),
});

function safePathSegment(value: string, label: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new Error(`${label} may only contain letters, numbers, hyphens, and underscores.`);
  }
  return value;
}

export function defaultImportStateRoot(): string {
  return join(homedir(), '.mastra', 'imports');
}

export function resolveImportStateDirectory(args: { stateRoot?: string; projectId: string; importId: string }): string {
  return join(
    args.stateRoot ?? defaultImportStateRoot(),
    safePathSegment(args.projectId, 'Project ID'),
    safePathSegment(args.importId, 'Import ID'),
  );
}

export async function initializeImportState(args: {
  stateRoot?: string;
  projectId: string;
  sourceBaseUrl: string;
  collectorOrigin: string;
  environment?: string;
  snapshotAt: string;
  cutoffAt: string;
}): Promise<{ directory: string; manifest: TraceImportManifest }> {
  const importId = randomUUID();
  const directory = resolveImportStateDirectory({
    stateRoot: args.stateRoot,
    projectId: args.projectId,
    importId,
  });
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700).catch(() => {});
  const now = new Date().toISOString();
  const manifest: TraceImportManifest = {
    schemaVersion: TRACE_IMPORT_SCHEMA_VERSION,
    mapperVersion: TRACE_IMPORT_MAPPER_VERSION,
    idAlgorithmVersion: TRACE_IMPORT_ID_ALGORITHM_VERSION,
    shardCount: TRACE_IMPORT_SHARD_COUNT,
    importId,
    provider: 'langfuse',
    createdAt: now,
    updatedAt: now,
    snapshotAt: args.snapshotAt,
    cutoffAt: args.cutoffAt,
    fields: TRACE_IMPORT_FIELDS,
    source: {
      baseUrl: args.sourceBaseUrl,
      complete: false,
      pageCount: 0,
      observationCount: 0,
      spoolBytes: 0,
      unknownObservationTypes: [],
    },
    target: {
      projectId: args.projectId,
      collectorOrigin: args.collectorOrigin,
      environment: args.environment,
      warnings: [],
    },
    phase: 'reading',
    counts: {
      readSpans: 0,
      eligibleTraces: 0,
      eligibleSpans: 0,
      skippedTraces: 0,
      skippedSpans: 0,
      enqueuedSpans: 0,
      verifiedTraces: 0,
      truncationRiskSpans: 0,
      sourceRetries: 0,
      targetRetries: 0,
      skipReasons: {},
    },
    estimatedPayloadBytes: 0,
    batches: [],
    verification: {
      status: 'not-performed',
      reason: 'Upload has not completed.',
      sampledTraces: 0,
      verifiedTraces: 0,
      attempts: 0,
      samples: [],
    },
  };
  await writeManifest(directory, manifest);
  return { directory, manifest };
}

export async function readManifest(directory: string): Promise<TraceImportManifest> {
  let json: unknown;
  try {
    json = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  } catch (cause) {
    throw new Error(`Could not read the trace import manifest at ${directory}.`, { cause });
  }
  const parsed = manifestSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Trace import manifest is invalid: ${parsed.error.issues[0]?.message ?? 'schema mismatch'}`);
  }
  return parsed.data as TraceImportManifest;
}

export async function writeManifest(directory: string, manifest: TraceImportManifest): Promise<void> {
  const next = { ...manifest, updatedAt: new Date().toISOString() };
  const parsed = manifestSchema.parse(next);
  const temporary = join(directory, `.manifest-${randomUUID()}.tmp`);
  const target = join(directory, 'manifest.json');
  const handle = await open(temporary, 'w', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(parsed, null, 2)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, target);
  const directoryHandle = await open(directory, 'r').catch(() => undefined);
  if (directoryHandle) {
    try {
      await directoryHandle.sync().catch(() => {});
    } finally {
      await directoryHandle.close();
    }
  }
  await chmod(target, 0o600).catch(() => {});
  manifest.updatedAt = next.updatedAt;
}

export function assertResumeCompatible(
  manifest: TraceImportManifest,
  expected: {
    sourceBaseUrl: string;
    projectId: string;
    collectorOrigin: string;
    environment?: string;
  },
): void {
  const changed: string[] = [];
  if (manifest.source.baseUrl !== expected.sourceBaseUrl) changed.push('Langfuse base URL');
  if (manifest.target.projectId !== expected.projectId) changed.push('target project');
  if (manifest.target.collectorOrigin !== expected.collectorOrigin) changed.push('collector origin');
  if (manifest.target.environment !== expected.environment) changed.push('target environment');
  if (changed.length > 0) {
    throw new Error(`Cannot resume because ${changed.join(', ')} changed.`);
  }
}
