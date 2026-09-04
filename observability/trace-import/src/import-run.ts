import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, mkdir, open, readFile, rm, stat, truncate, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { TraceImportError } from './errors.js';
import { defaultSleep, type FetchLike, type Sleep } from './http.js';
import {
  assertResumeCompatible,
  initializeImportState,
  readManifest,
  resolveImportStateDirectory,
  writeManifest,
} from './manifest.js';
import { normalizeLangfuseTrace } from './providers/langfuse/adapter.js';
import { LangfuseObservationsClient } from './providers/langfuse/client.js';
import { langfuseObservationsPageSchema, langfuseObservationSchema } from './providers/langfuse/schema.js';
import { MastraCollectorClient, resolveCollectorEndpoint } from './target/collector-client.js';
import { collectorPublishBodySchema, type CollectorSpan } from './target/collector-schema.js';
import { MastraQueryClient } from './target/query-client.js';
import { assembleTraces, createSkippedTrace } from './trace-assembler.js';
import {
  DEFAULT_RETENTION_DAYS,
  DEFAULT_VERIFICATION_MAX_ATTEMPTS,
  DEFAULT_VERIFICATION_SAMPLE_SIZE,
  DEFAULT_MAX_SOURCE_SPOOL_BYTES,
  DEFAULT_SOURCE_PAGE_SIZE,
  DEFAULT_TARGET_BATCH_BYTES,
  DEFAULT_TARGET_BATCH_SIZE,
  MAX_TARGET_BATCH_SIZE,
  TRACE_IMPORT_EXPAND_METADATA,
  TRACE_IMPORT_FIELDS,
  TRACE_IMPORT_SHARD_COUNT,
  type ImportBatchManifest,
  type SkippedTrace,
  type TraceImportManifest,
  type TraceImportReport,
} from './types.js';

const SOURCE_SPOOL = 'source-pages.jsonl';
const BATCHES_DIRECTORY = 'batches';
const SHARDS_DIRECTORY = 'shards';
const MAX_SKIPPED_TRACE_SAMPLES = 50;
const CONSISTENCY_WARNING =
  'Langfuse observations from older SDKs or direct OTLP exporters can take up to 15 minutes to appear. Re-run with an overlapping window if the source was still receiving traffic.';

export interface RunTraceImportOptions {
  /** Required for a new import and while a resumed import is still downloading source data. */
  source?: {
    baseUrl: string;
    publicKey: string;
    secretKey: string;
  };
  target: {
    projectId: string;
    accessToken?: string;
    collectorUrl?: string;
    environment?: string;
  };
  stateRoot?: string;
  resumeId?: string;
  dryRun?: boolean;
  keepState?: boolean;
  batchSize?: number;
  maxStagingBytes?: number;
  signal?: AbortSignal;
  confirm?: (report: TraceImportReport) => Promise<boolean>;
}

/** Test and resource-limit seams kept outside the package's public entry point. */
export interface RunTraceImportDependencies {
  maxBatchBytes?: number;
  now?: Date;
  fetch?: FetchLike;
  sleep?: Sleep;
  verify?: boolean;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function reportFromManifest(
  manifest: TraceImportManifest,
  directory: string,
  status: TraceImportReport['status'],
): TraceImportReport {
  const warnings = manifest.source.unknownObservationTypes.length
    ? [
        `Unknown Langfuse observation types were mapped to generic spans: ${manifest.source.unknownObservationTypes.join(', ')}.`,
      ]
    : [];
  if (manifest.counts.truncationRiskSpans > 0) {
    warnings.push(
      `${manifest.counts.truncationRiskSpans} eligible spans contain fields that Platform may truncate at its storage limits.`,
    );
  }
  for (const warning of manifest.target.warnings) {
    warnings.push(`Platform warning ${warning.code}: ${warning.message}`);
  }
  return {
    importId: manifest.importId,
    stateDirectory: directory,
    snapshotAt: manifest.snapshotAt,
    cutoffAt: manifest.cutoffAt,
    sourceBaseUrl: manifest.source.baseUrl,
    sourceProjectId: manifest.source.projectId,
    targetProjectId: manifest.target.projectId,
    collectorOrigin: manifest.target.collectorOrigin,
    environment: manifest.target.environment,
    counts: manifest.counts,
    estimatedPayloadBytes: manifest.estimatedPayloadBytes,
    skippedTraceSamples: manifest.skippedTraceSamples,
    status,
    verification: {
      status: manifest.verification.status,
      reason: manifest.verification.reason,
      sampledTraces: manifest.verification.sampledTraces,
      verifiedTraces: manifest.verification.verifiedTraces,
      attempts: manifest.verification.attempts,
    },
    warnings,
    consistencyWarning: CONSISTENCY_WARNING,
  };
}

async function writeReport(directory: string, report: TraceImportReport): Promise<void> {
  const path = join(directory, 'report.json');
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600).catch(() => {});
}

async function appendDurably(path: string, value: string): Promise<number> {
  const handle = await open(path, 'a', 0o600);
  try {
    await handle.write(value);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(path, 0o600).catch(() => {});
  return (await stat(path)).size;
}

async function writeDurably(path: string, value: string): Promise<void> {
  const handle = await open(path, 'w', 0o600);
  try {
    await handle.writeFile(value);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(path, 0o600).catch(() => {});
}

async function ensureSpoolAtCommittedOffset(directory: string, manifest: TraceImportManifest): Promise<string> {
  const spool = join(directory, SOURCE_SPOOL);
  try {
    const currentSize = (await stat(spool)).size;
    if (currentSize < manifest.source.spoolBytes) {
      throw new Error('The source spool is shorter than the committed manifest offset.');
    }
    if (currentSize > manifest.source.spoolBytes) await truncate(spool, manifest.source.spoolBytes);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' || manifest.source.spoolBytes !== 0) throw error;
    await writeFile(spool, '', { mode: 0o600 });
  }
  return spool;
}

async function stageSource(
  directory: string,
  manifest: TraceImportManifest,
  client: LangfuseObservationsClient,
  maxSpoolBytes: number,
  signal?: AbortSignal,
): Promise<void> {
  const spool = await ensureSpoolAtCommittedOffset(directory, manifest);
  const seenCursors = new Set<string>();
  if (manifest.source.cursor) seenCursors.add(manifest.source.cursor);

  while (!manifest.source.complete) {
    signal?.throwIfAborted();
    const page = await client.getPage({
      cutoffAt: manifest.cutoffAt,
      snapshotAt: manifest.snapshotAt,
      fields: manifest.fields,
      expandMetadata: TRACE_IMPORT_EXPAND_METADATA,
      limit: DEFAULT_SOURCE_PAGE_SIZE,
      cursor: manifest.source.cursor,
      signal,
    });

    const pageProjectIds = new Set(page.data.map(observation => observation.projectId));
    if (pageProjectIds.size > 1) {
      throw new TraceImportError({
        message: 'Langfuse returned observations from more than one project.',
        stage: 'source',
      });
    }
    const pageProjectId = pageProjectIds.values().next().value;
    if (pageProjectId && manifest.source.projectId && pageProjectId !== manifest.source.projectId) {
      throw new TraceImportError({
        message: 'The Langfuse project changed while the snapshot was being read.',
        stage: 'source',
      });
    }

    // The page is fsynced before its cursor becomes authoritative in the manifest.
    const serializedPage = `${JSON.stringify(page)}\n`;
    if (manifest.source.spoolBytes + Buffer.byteLength(serializedPage) > maxSpoolBytes) {
      throw new TraceImportError({
        message: `Langfuse source data exceeds the ${maxSpoolBytes}-byte local staging limit.`,
        stage: 'source',
      });
    }
    const spoolBytes = await appendDurably(spool, serializedPage);
    const nextCursor = page.meta.cursor ?? undefined;
    if (nextCursor && seenCursors.has(nextCursor)) {
      throw new TraceImportError({
        message: 'Langfuse returned a repeated pagination cursor.',
        stage: 'source',
      });
    }
    if (nextCursor) seenCursors.add(nextCursor);

    manifest.source.projectId ??= pageProjectId;
    manifest.source.pageCount += 1;
    manifest.source.observationCount += page.data.length;
    manifest.source.spoolBytes = spoolBytes;
    manifest.source.cursor = nextCursor;
    manifest.source.complete = !nextCursor;
    manifest.counts.readSpans = manifest.source.observationCount;
    manifest.phase = 'reading';
    delete manifest.lastError;
    await writeManifest(directory, manifest);
  }
}

function shardIndex(traceId: string | null | undefined): number {
  const digest = createHash('sha256')
    .update(traceId || '__missing_trace_id__')
    .digest();
  return digest[0]! % TRACE_IMPORT_SHARD_COUNT;
}

async function shardSource(directory: string, signal?: AbortSignal): Promise<string[]> {
  const shardsDirectory = join(directory, SHARDS_DIRECTORY);
  await rm(shardsDirectory, { recursive: true, force: true });
  await mkdir(shardsDirectory, { recursive: true, mode: 0o700 });
  const shardPaths = Array.from({ length: TRACE_IMPORT_SHARD_COUNT }, (_, index) =>
    join(shardsDirectory, `${index.toString().padStart(2, '0')}.jsonl`),
  );
  const handles = await Promise.all(shardPaths.map(path => open(path, 'a', 0o600)));
  try {
    const lines = createInterface({
      input: createReadStream(join(directory, SOURCE_SPOOL), { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });
    for await (const line of lines) {
      signal?.throwIfAborted();
      if (!line) continue;
      const page = langfuseObservationsPageSchema.parse(JSON.parse(line));
      for (const observation of page.data) {
        signal?.throwIfAborted();
        await handles[shardIndex(observation.traceId)]!.write(`${JSON.stringify(observation)}\n`);
      }
    }
    await Promise.all(handles.map(handle => handle.sync()));
  } finally {
    await Promise.all(handles.map(handle => handle.close()));
  }
  return shardPaths;
}

async function readShard(path: string, signal?: AbortSignal) {
  const observations = [];
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    signal?.throwIfAborted();
    if (line) observations.push(langfuseObservationSchema.parse(JSON.parse(line)));
  }
  return observations;
}

function recordSkip(manifest: TraceImportManifest, skipped: SkippedTrace): void {
  manifest.counts.skippedTraces += 1;
  manifest.counts.skippedSpans += skipped.observationCount;
  manifest.counts.skipReasons[skipped.reason] = (manifest.counts.skipReasons[skipped.reason] ?? 0) + 1;
  if (manifest.skippedTraceSamples.length < MAX_SKIPPED_TRACE_SAMPLES) {
    manifest.skippedTraceSamples.push(skipped);
  }
}

const PLATFORM_FIELD_SIZE_BYTES = 1024 * 1024;
const PLATFORM_FIELD_NAME_BYTES = 200;
const PLATFORM_MAX_ARRAY_LENGTH = 1000;
const PLATFORM_MAX_NESTING_DEPTH = 100;
const EMPTY_BATCH_BYTES = Buffer.byteLength('{"spans":[]}');

function exceedsPlatformStorageShape(value: unknown, depth = 0): boolean {
  if (depth > PLATFORM_MAX_NESTING_DEPTH) return true;
  if (typeof value === 'string') return Buffer.byteLength(value) > PLATFORM_FIELD_SIZE_BYTES;
  if (Array.isArray(value)) {
    return value.length > PLATFORM_MAX_ARRAY_LENGTH || value.some(item => exceedsPlatformStorageShape(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).some(
      ([key, item]) =>
        Buffer.byteLength(key) > PLATFORM_FIELD_NAME_BYTES || exceedsPlatformStorageShape(item, depth + 1),
    );
  }
  return false;
}

function mayBeTruncatedByPlatform(span: CollectorSpan): boolean {
  const fields = [span.metadata, span.attributes, span.input, span.output, span.error];
  return fields.some(
    value =>
      exceedsPlatformStorageShape(value) ||
      (value !== undefined && Buffer.byteLength(JSON.stringify(value)) > PLATFORM_FIELD_SIZE_BYTES),
  );
}

class BatchWriter {
  private current: CollectorSpan[] = [];
  private readonly manifests: ImportBatchManifest[] = [];
  private estimatedPayloadBytes = 0;
  private currentBodyBytes = EMPTY_BATCH_BYTES;

  constructor(
    private readonly directory: string,
    private readonly maxCount: number,
    private readonly maxBytes: number,
  ) {}

  canFitSingle(span: CollectorSpan): boolean {
    return this.bytesForSingleSpan(span) <= this.maxBytes;
  }

  async add(spans: CollectorSpan[]): Promise<void> {
    for (const span of spans) {
      const proposedBytes = this.bytesAfterAdding(span);
      if (this.current.length > 0 && (this.current.length + 1 > this.maxCount || proposedBytes > this.maxBytes)) {
        await this.flush();
      }
      this.current.push(span);
      this.currentBodyBytes = this.bytesAfterAdding(span, this.currentBodyBytes, this.current.length - 1);
    }
  }

  async finish(): Promise<{ batches: ImportBatchManifest[]; estimatedPayloadBytes: number }> {
    await this.flush();
    return { batches: this.manifests, estimatedPayloadBytes: this.estimatedPayloadBytes };
  }

  private async flush(): Promise<void> {
    if (this.current.length === 0) return;
    const body = JSON.stringify(collectorPublishBodySchema.parse({ spans: this.current }));
    const byteLength = Buffer.byteLength(body);
    if (byteLength > this.maxBytes) throw new Error('Internal batching error: target batch exceeds byte limit.');
    const index = this.manifests.length;
    const file = `${index.toString().padStart(6, '0')}.json`;
    const path = join(this.directory, file);
    await writeDurably(path, body);
    this.manifests.push({
      index,
      file,
      spanCount: this.current.length,
      byteLength,
      sha256: sha256(body),
      status: 'pending',
      attempts: 0,
    });
    this.estimatedPayloadBytes += byteLength;
    this.current = [];
    this.currentBodyBytes = EMPTY_BATCH_BYTES;
  }

  private bytesForSingleSpan(span: CollectorSpan): number {
    return EMPTY_BATCH_BYTES + Buffer.byteLength(JSON.stringify(span));
  }

  private bytesAfterAdding(
    span: CollectorSpan,
    currentBodyBytes = this.currentBodyBytes,
    currentCount = this.current.length,
  ): number {
    const spanBytes = Buffer.byteLength(JSON.stringify(span));
    const commaBytes = currentCount > 0 ? 1 : 0;
    return currentBodyBytes + commaBytes + spanBytes;
  }
}

async function planBatches(
  directory: string,
  manifest: TraceImportManifest,
  options: { batchSize: number; maxBatchBytes: number },
  signal?: AbortSignal,
): Promise<void> {
  const batchDirectory = join(directory, BATCHES_DIRECTORY);
  await rm(batchDirectory, { recursive: true, force: true });
  await mkdir(batchDirectory, { recursive: true, mode: 0o700 });
  const shardPaths = await shardSource(directory, signal);
  const writer = new BatchWriter(batchDirectory, options.batchSize, options.maxBatchBytes);

  manifest.counts.eligibleTraces = 0;
  manifest.counts.eligibleSpans = 0;
  manifest.counts.skippedTraces = 0;
  manifest.counts.skippedSpans = 0;
  manifest.counts.enqueuedSpans = 0;
  manifest.counts.verifiedTraces = 0;
  manifest.counts.truncationRiskSpans = 0;
  manifest.counts.skipReasons = {};
  manifest.skippedTraceSamples = [];
  manifest.verification = {
    status: 'not-performed',
    reason: 'Upload has not completed.',
    sampledTraces: 0,
    verifiedTraces: 0,
    attempts: 0,
    samples: [],
  };
  const unknownObservationTypes = new Set<string>();
  const verificationSamples: TraceImportManifest['verification']['samples'] = [];

  for (const shardPath of shardPaths) {
    signal?.throwIfAborted();
    const assembled = assembleTraces(await readShard(shardPath, signal), {
      cutoffAt: manifest.cutoffAt,
      snapshotAt: manifest.snapshotAt,
    });
    for (const skipped of assembled.skipped) {
      recordSkip(manifest, skipped);
    }
    for (const trace of assembled.traces) {
      signal?.throwIfAborted();
      const normalized = normalizeLangfuseTrace(trace, {
        importBatchId: manifest.importId,
        environment: manifest.target.environment,
      });
      for (const type of normalized.unknownTypes) unknownObservationTypes.add(type);
      manifest.counts.truncationRiskSpans += normalized.spans.filter(mayBeTruncatedByPlatform).length;
      if (normalized.spans.some(span => !writer.canFitSingle(span))) {
        recordSkip(manifest, createSkippedTrace(trace.sourceTraceId, trace.observations, 'oversized_span'));
        continue;
      }
      manifest.counts.eligibleTraces += 1;
      manifest.counts.eligibleSpans += normalized.spans.length;
      verificationSamples.push({
        traceId: normalized.spans[0]!.traceId,
        spanIds: normalized.spans.map(span => span.spanId).sort(),
      });
      verificationSamples.sort((left, right) => left.traceId.localeCompare(right.traceId));
      if (verificationSamples.length > DEFAULT_VERIFICATION_SAMPLE_SIZE) verificationSamples.pop();
      await writer.add(normalized.spans);
    }
  }

  const planned = await writer.finish();
  manifest.source.unknownObservationTypes = [...unknownObservationTypes].sort();
  manifest.batches = planned.batches;
  manifest.estimatedPayloadBytes = planned.estimatedPayloadBytes;
  manifest.verification.samples = verificationSamples;
  manifest.verification.sampledTraces = verificationSamples.length;
  if (verificationSamples.length === 0) manifest.verification.reason = 'No eligible traces were available to verify.';
  manifest.phase = 'planned';
  delete manifest.lastError;
  await writeManifest(directory, manifest);
}

async function verifyUploadedTraces(
  directory: string,
  manifest: TraceImportManifest,
  client: MastraQueryClient,
  maxAttempts: number,
  sleep: Sleep,
  signal?: AbortSignal,
): Promise<void> {
  const samples = manifest.verification.samples;
  if (samples.length === 0) {
    manifest.verification = {
      ...manifest.verification,
      status: 'not-performed',
      reason: 'No eligible traces were available to verify.',
      sampledTraces: 0,
      verifiedTraces: 0,
      attempts: 0,
    };
    manifest.counts.verifiedTraces = 0;
    await writeManifest(directory, manifest);
    return;
  }

  const pending = new Map(samples.map(sample => [sample.traceId, sample]));
  const verified = new Set<string>();
  manifest.verification = {
    ...manifest.verification,
    status: 'not-performed',
    reason: 'Waiting for uploaded traces to become queryable.',
    sampledTraces: samples.length,
    verifiedTraces: 0,
    attempts: 0,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    signal?.throwIfAborted();
    manifest.verification.attempts = attempt;
    const results = await Promise.all(
      [...pending.values()].map(async sample => ({
        sample,
        result: await client.getTraceSpanIds(sample.traceId, signal),
      })),
    );
    for (const { sample, result } of results) {
      if (result.kind === 'found') {
        const actual = new Set(result.spanIds);
        if (sample.spanIds.every(spanId => actual.has(spanId))) {
          pending.delete(sample.traceId);
          verified.add(sample.traceId);
        }
        continue;
      }
      if (result.kind === 'unavailable') {
        manifest.counts.verifiedTraces = verified.size;
        manifest.verification = {
          ...manifest.verification,
          status: verified.size > 0 ? 'partial' : 'unavailable',
          reason: result.reason,
          verifiedTraces: verified.size,
        };
        await writeManifest(directory, manifest);
        return;
      }
    }

    manifest.counts.verifiedTraces = verified.size;
    manifest.verification.verifiedTraces = verified.size;
    if (pending.size === 0) {
      manifest.verification.status = 'verified';
      delete manifest.verification.reason;
      await writeManifest(directory, manifest);
      return;
    }
    await writeManifest(directory, manifest);
    if (attempt < maxAttempts) await sleep(Math.min(8_000, 500 * 2 ** (attempt - 1)), signal);
  }

  manifest.verification.status = verified.size > 0 ? 'partial' : 'timed-out';
  manifest.verification.reason = 'Uploaded traces were not queryable before the verification timeout.';
  await writeManifest(directory, manifest);
}

async function uploadBatches(
  directory: string,
  manifest: TraceImportManifest,
  client: MastraCollectorClient,
  signal?: AbortSignal,
): Promise<void> {
  manifest.phase = 'uploading';
  await writeManifest(directory, manifest);
  for (const batch of manifest.batches) {
    signal?.throwIfAborted();
    const body = await readFile(join(directory, BATCHES_DIRECTORY, batch.file), 'utf8');
    if (Buffer.byteLength(body) !== batch.byteLength || sha256(body) !== batch.sha256) {
      throw new TraceImportError({
        message: `Saved batch ${batch.index} no longer matches its manifest hash.`,
        stage: 'target',
      });
    }
    collectorPublishBodySchema.parse(JSON.parse(body));
    if (batch.status === 'acknowledged') continue;
    batch.attempts += 1;
    await writeManifest(directory, manifest);
    const response = await client.publishBody(body, batch.spanCount, signal);
    for (const warning of response.warnings ?? []) {
      if (
        !manifest.target.warnings.some(
          existing => existing.code === warning.code && existing.message === warning.message,
        )
      ) {
        manifest.target.warnings.push(warning);
      }
    }
    batch.status = 'acknowledged';
    batch.acknowledgedAt = new Date().toISOString();
    manifest.counts.enqueuedSpans += batch.spanCount;
    await writeManifest(directory, manifest);
  }
  manifest.phase = 'complete';
  delete manifest.lastError;
  await writeManifest(directory, manifest);
}

async function cleanupSensitiveState(directory: string): Promise<void> {
  await rm(join(directory, SOURCE_SPOOL), { force: true });
  await rm(join(directory, SHARDS_DIRECTORY), { recursive: true, force: true });
  await rm(join(directory, BATCHES_DIRECTORY), { recursive: true, force: true });
}

export function runTraceImport(options: RunTraceImportOptions): Promise<TraceImportReport> {
  return runTraceImportWithDependencies(options);
}

export async function runTraceImportWithDependencies(
  options: RunTraceImportOptions,
  dependencies: RunTraceImportDependencies = {},
): Promise<TraceImportReport> {
  const batchSize = options.batchSize ?? DEFAULT_TARGET_BATCH_SIZE;
  const maxBatchBytes = dependencies.maxBatchBytes ?? DEFAULT_TARGET_BATCH_BYTES;
  const maxSpoolBytes = options.maxStagingBytes ?? DEFAULT_MAX_SOURCE_SPOOL_BYTES;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_TARGET_BATCH_SIZE) {
    throw new Error(`Batch size must be an integer from 1 to ${MAX_TARGET_BATCH_SIZE}.`);
  }
  if (!Number.isInteger(maxBatchBytes) || maxBatchBytes < 1024) {
    throw new Error('Target batch byte limit must be an integer of at least 1024 bytes.');
  }
  if (!Number.isInteger(maxSpoolBytes) || maxSpoolBytes < 1024) {
    throw new Error('Source staging byte limit must be an integer of at least 1024 bytes.');
  }

  const target = resolveCollectorEndpoint(options.target.collectorUrl, options.target.projectId);
  let manifest: TraceImportManifest;
  const sourceClient = options.source
    ? new LangfuseObservationsClient({
        ...options.source,
        fetch: dependencies.fetch,
        sleep: dependencies.sleep,
        onRetry: () => {
          manifest.counts.sourceRetries += 1;
        },
      })
    : undefined;
  let directory: string;
  if (options.resumeId) {
    directory = resolveImportStateDirectory({
      stateRoot: options.stateRoot,
      projectId: options.target.projectId,
      importId: options.resumeId,
    });
    manifest = await readManifest(directory);
    assertResumeCompatible(manifest, {
      sourceBaseUrl: sourceClient?.baseUrl ?? manifest.source.baseUrl,
      projectId: options.target.projectId,
      collectorOrigin: target.origin,
      environment: options.target.environment,
    });
  } else {
    if (!sourceClient) {
      throw new Error('Langfuse credentials are required to start a trace import.');
    }
    const snapshotAt = (dependencies.now ?? new Date()).toISOString();
    const cutoffAt = new Date(Date.parse(snapshotAt) - DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const initialized = await initializeImportState({
      stateRoot: options.stateRoot,
      projectId: options.target.projectId,
      sourceBaseUrl: sourceClient.baseUrl,
      collectorOrigin: target.origin,
      environment: options.target.environment,
      snapshotAt,
      cutoffAt,
    });
    directory = initialized.directory;
    manifest = initialized.manifest;
  }

  try {
    if (manifest.phase !== 'complete' && !manifest.source.complete) {
      if (!sourceClient) {
        throw new Error(
          'Langfuse credentials are required because this resumed import has not finished downloading source data.',
        );
      }
      await stageSource(directory, manifest, sourceClient, maxSpoolBytes, options.signal);
    }
    if (manifest.phase === 'reading' || (manifest.phase === 'paused' && manifest.batches.length === 0)) {
      await planBatches(directory, manifest, { batchSize, maxBatchBytes }, options.signal);
    }

    if (options.dryRun) {
      const report = reportFromManifest(manifest, directory, 'dry-run');
      await writeReport(directory, report);
      return report;
    }
    if (manifest.phase === 'complete') {
      if (
        dependencies.verify !== false &&
        manifest.verification.status !== 'verified' &&
        manifest.verification.samples.length > 0
      ) {
        if (!options.target.accessToken) {
          manifest.verification.status = 'unavailable';
          manifest.verification.reason = 'A Platform organization key is required for post-upload verification.';
          await writeManifest(directory, manifest);
        } else {
          await verifyUploadedTraces(
            directory,
            manifest,
            new MastraQueryClient({
              collectorOrigin: target.origin,
              projectId: options.target.projectId,
              accessToken: options.target.accessToken,
              fetch: dependencies.fetch,
            }),
            DEFAULT_VERIFICATION_MAX_ATTEMPTS,
            dependencies.sleep ?? defaultSleep,
            options.signal,
          );
        }
      }
      const report = reportFromManifest(manifest, directory, 'complete');
      await writeReport(directory, report);
      if (!options.keepState) await cleanupSensitiveState(directory);
      return report;
    }

    if (manifest.batches.length === 0) {
      manifest.phase = 'complete';
      await writeManifest(directory, manifest);
    } else {
      const plannedReport = reportFromManifest(manifest, directory, 'dry-run');
      if (options.confirm && !(await options.confirm(plannedReport))) {
        const report = reportFromManifest(manifest, directory, 'cancelled');
        await writeReport(directory, report);
        return report;
      }
      if (!options.target.accessToken) {
        throw new Error('MASTRA_PLATFORM_ACCESS_TOKEN is required unless --dry-run is used.');
      }
      const collectorClient = new MastraCollectorClient({
        collectorUrl: options.target.collectorUrl,
        projectId: options.target.projectId,
        accessToken: options.target.accessToken,
        fetch: dependencies.fetch,
        sleep: dependencies.sleep,
        onRetry: () => {
          manifest.counts.targetRetries += 1;
        },
      });
      await uploadBatches(directory, manifest, collectorClient, options.signal);
    }

    if (dependencies.verify !== false && manifest.verification.samples.length > 0) {
      await verifyUploadedTraces(
        directory,
        manifest,
        new MastraQueryClient({
          collectorOrigin: target.origin,
          projectId: options.target.projectId,
          accessToken: options.target.accessToken!,
          fetch: dependencies.fetch,
        }),
        DEFAULT_VERIFICATION_MAX_ATTEMPTS,
        dependencies.sleep ?? defaultSleep,
        options.signal,
      );
    }

    const report = reportFromManifest(manifest, directory, 'complete');
    await writeReport(directory, report);
    if (!options.keepState) await cleanupSensitiveState(directory);
    return report;
  } catch (error) {
    const interrupted = options.signal?.aborted;
    if (interrupted || (error instanceof TraceImportError && error.resumable)) {
      manifest.phase = 'paused';
      manifest.lastError = {
        stage: error instanceof TraceImportError ? error.stage : manifest.source.complete ? 'target' : 'source',
        message: interrupted ? 'Import interrupted' : (error as Error).message,
        at: new Date().toISOString(),
      };
      await writeManifest(directory, manifest);
      const report = reportFromManifest(manifest, directory, 'paused');
      await writeReport(directory, report);
      return report;
    }
    throw error;
  }
}
