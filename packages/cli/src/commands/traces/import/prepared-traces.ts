import { createReadStream } from 'node:fs';
import { open, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { MAX_RECORDED_SOURCE_SPAN_IDS, readTraceImportManifest, writeTraceImportManifest } from './manifest.js';
import type { TraceImportProvider } from './provider.js';
import type { PreparedTraceBatch, SkippedTrace, TraceImportManifest, TraceImportTrace } from './types.js';
import { validateTraceImportTrace } from './validation.js';

export const PREPARED_TRACES_FILE = 'traces.jsonl';
export const DEFAULT_MAX_PREPARED_BYTES = 5 * 1024 * 1024 * 1024;
export const DEFAULT_MAX_BATCH_BYTES = 4 * 1024 * 1024;
export const DEFAULT_PREFERRED_SPANS_PER_BATCH = 100;

const EMPTY_PAYLOAD_BYTES = Buffer.byteLength('{"spans":[]}');
const MAX_RECORDED_WARNINGS = 50;
const MAX_RECORDED_SKIP_SAMPLES = 50;

export interface PrepareTraceImportOptions {
  directory: string;
  provider: TraceImportProvider;
  signal?: AbortSignal;
  limits?: {
    maxPreparedBytes?: number;
    maxTracePayloadBytes?: number;
  };
}

export interface TraceBatchOptions {
  preferredSpansPerBatch?: number;
  maxPayloadBytes?: number;
  signal?: AbortSignal;
}

function serializedSpanBytes(trace: TraceImportTrace): number[] {
  return trace.spans.map(span => Buffer.byteLength(JSON.stringify(span)));
}

/** Exact byte size of the JSON body used to upload one complete trace. */
export function tracePayloadBytes(trace: TraceImportTrace): number {
  const spanBytes = serializedSpanBytes(trace);
  return EMPTY_PAYLOAD_BYTES + spanBytes.reduce((total, bytes) => total + bytes, 0) + Math.max(0, spanBytes.length - 1);
}

function traceBatchContribution(trace: TraceImportTrace): number {
  const spanBytes = serializedSpanBytes(trace);
  return spanBytes.reduce((total, bytes) => total + bytes, 0) + Math.max(0, spanBytes.length - 1);
}

function recordSkip(manifest: TraceImportManifest, skipped: SkippedTrace): void {
  if (!skipped.reason || !Number.isSafeInteger(skipped.spanCount) || skipped.spanCount < 0) {
    throw new Error('Provider returned an invalid skipped-trace record.');
  }
  manifest.counts.skippedTraces++;
  manifest.counts.skippedSpans += skipped.spanCount;
  manifest.counts.skipReasons[skipped.reason] = (manifest.counts.skipReasons[skipped.reason] ?? 0) + 1;
  if (manifest.skippedTraceSamples.length < MAX_RECORDED_SKIP_SAMPLES) {
    manifest.skippedTraceSamples.push({
      ...skipped,
      sourceSpanIds: skipped.sourceSpanIds?.slice(0, MAX_RECORDED_SOURCE_SPAN_IDS),
    });
  }
}

function recordWarning(manifest: TraceImportManifest, warning: string): void {
  if (manifest.warnings.length < MAX_RECORDED_WARNINGS && !manifest.warnings.includes(warning)) {
    manifest.warnings.push(warning);
  }
}

/**
 * Read and validate provider output without contacting Mastra Platform.
 *
 * Each accepted trace is stored as one JSONL record, which makes a trace the
 * smallest resumable and batchable unit. A failed preparation is restarted
 * from the provider instead of attempting to repair a partial local file.
 */
export async function prepareTraceImport(options: PrepareTraceImportOptions): Promise<TraceImportManifest> {
  const savedManifest = await readTraceImportManifest(options.directory);
  if (savedManifest.phase !== 'preparing') {
    throw new Error('Only an unfinished trace import can be prepared.');
  }

  const maxPreparedBytes = options.limits?.maxPreparedBytes ?? DEFAULT_MAX_PREPARED_BYTES;
  const maxTracePayloadBytes = options.limits?.maxTracePayloadBytes ?? DEFAULT_MAX_BATCH_BYTES;
  if (!Number.isSafeInteger(maxPreparedBytes) || maxPreparedBytes < 1) {
    throw new Error('The prepared trace byte limit must be a positive integer.');
  }
  if (!Number.isSafeInteger(maxTracePayloadBytes) || maxTracePayloadBytes < EMPTY_PAYLOAD_BYTES + 1) {
    throw new Error('The trace payload byte limit is too small.');
  }

  let manifest: TraceImportManifest = {
    ...savedManifest,
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
  };
  manifest = await writeTraceImportManifest(options.directory, manifest);

  const preparedFile = join(options.directory, PREPARED_TRACES_FILE);
  const temporaryFile = `${preparedFile}.tmp`;
  const handle = await open(temporaryFile, 'w', 0o600);
  const destinationTraceIds = new Set<string>();
  let preparationSucceeded = false;

  try {
    const records = options.provider.read({
      ...manifest.window,
      source: manifest.source,
      importId: manifest.importId,
      signal: options.signal,
      onRetry: () => {
        manifest.counts.sourceRetries++;
      },
    });

    for await (const record of records) {
      options.signal?.throwIfAborted();
      if (record.kind === 'skipped') {
        manifest.counts.readSpans += record.skipped.spanCount;
        recordSkip(manifest, record.skipped);
        continue;
      }

      const trace = validateTraceImportTrace(record.trace);
      manifest.counts.readSpans += trace.spans.length;
      const destinationTraceId = trace.spans[0]!.traceId;
      if (destinationTraceIds.has(destinationTraceId)) {
        throw new Error(`Provider returned destination trace ${destinationTraceId} more than once.`);
      }
      destinationTraceIds.add(destinationTraceId);

      for (const warning of record.warnings ?? []) recordWarning(manifest, warning);

      const payloadBytes = tracePayloadBytes(trace);
      if (payloadBytes > maxTracePayloadBytes) {
        recordSkip(manifest, {
          sourceTraceId: trace.sourceTraceId,
          spanCount: trace.spans.length,
          reason: 'trace_too_large',
          detail: `The complete trace needs ${payloadBytes} bytes; the upload limit is ${maxTracePayloadBytes} bytes.`,
          traceName: trace.spans[0]!.name,
        });
        continue;
      }

      const line = `${JSON.stringify(trace)}\n`;
      const lineBytes = Buffer.byteLength(line);
      if (manifest.preparedBytes + lineBytes > maxPreparedBytes) {
        throw new Error(`Prepared traces exceed the ${maxPreparedBytes}-byte local data limit.`);
      }

      await handle.writeFile(line);
      manifest.preparedBytes += lineBytes;
      manifest.counts.preparedTraces++;
      manifest.counts.preparedSpans += trace.spans.length;
    }

    await handle.close();
    await rename(temporaryFile, preparedFile);
    preparationSucceeded = true;
    return await writeTraceImportManifest(options.directory, { ...manifest, phase: 'prepared' });
  } finally {
    if (!preparationSucceeded) {
      await handle.close().catch(() => undefined);
      await rm(temporaryFile, { force: true });
    }
  }
}

export async function* readPreparedTraces(directory: string, signal?: AbortSignal): AsyncGenerator<TraceImportTrace> {
  const input = createReadStream(join(directory, PREPARED_TRACES_FILE), { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      signal?.throwIfAborted();
      if (!line) continue;
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch (cause) {
        throw new Error('The prepared trace file contains invalid JSON.', { cause });
      }
      yield validateTraceImportTrace(value);
    }
  } finally {
    lines.close();
    input.destroy();
  }
}

/** Read only unacknowledged traces and group them without splitting a trace. */
export async function* readPendingTraceBatches(
  directory: string,
  options: TraceBatchOptions = {},
): AsyncGenerator<PreparedTraceBatch> {
  const preferredSpansPerBatch = options.preferredSpansPerBatch ?? DEFAULT_PREFERRED_SPANS_PER_BATCH;
  const maxPayloadBytes = options.maxPayloadBytes ?? DEFAULT_MAX_BATCH_BYTES;
  if (!Number.isSafeInteger(preferredSpansPerBatch) || preferredSpansPerBatch < 1) {
    throw new Error('The preferred spans per batch must be a positive integer.');
  }
  if (!Number.isSafeInteger(maxPayloadBytes) || maxPayloadBytes < EMPTY_PAYLOAD_BYTES + 1) {
    throw new Error('The batch payload byte limit is too small.');
  }

  const manifest = await readTraceImportManifest(directory);
  if (manifest.phase === 'preparing') throw new Error('Trace preparation has not finished.');
  if (manifest.phase === 'complete') return;

  let traceIndex = 0;
  let totalSpans = 0;
  let firstTraceIndex = manifest.acknowledgedTraces;
  let traces: TraceImportTrace[] = [];
  let spanCount = 0;
  let payloadBytes = EMPTY_PAYLOAD_BYTES;

  for await (const trace of readPreparedTraces(directory, options.signal)) {
    totalSpans += trace.spans.length;
    if (traceIndex++ < manifest.acknowledgedTraces) continue;

    const contribution = traceBatchContribution(trace);
    const traceBytes = EMPTY_PAYLOAD_BYTES + contribution;
    if (traceBytes > maxPayloadBytes) {
      throw new Error(`Prepared trace ${trace.sourceTraceId} exceeds the current upload byte limit.`);
    }

    const separatorBytes = traces.length ? 1 : 0;
    const wouldExceedSpanPreference = spanCount + trace.spans.length > preferredSpansPerBatch;
    const wouldExceedByteLimit = payloadBytes + separatorBytes + contribution > maxPayloadBytes;
    if (traces.length && (wouldExceedSpanPreference || wouldExceedByteLimit)) {
      yield { firstTraceIndex, traces, spanCount, payloadBytes };
      firstTraceIndex += traces.length;
      traces = [];
      spanCount = 0;
      payloadBytes = EMPTY_PAYLOAD_BYTES;
    }

    payloadBytes += (traces.length ? 1 : 0) + contribution;
    spanCount += trace.spans.length;
    traces.push(trace);
  }

  if (traceIndex !== manifest.counts.preparedTraces || totalSpans !== manifest.counts.preparedSpans) {
    throw new Error('Prepared trace counts do not match the manifest. Start a new import.');
  }
  if (traces.length) yield { firstTraceIndex, traces, spanCount, payloadBytes };
}

/** Remove prepared trace data only after every trace has been acknowledged. */
export async function completeTraceImport(directory: string): Promise<TraceImportManifest> {
  const manifest = await readTraceImportManifest(directory);
  if (manifest.phase === 'preparing') {
    throw new Error('Cannot complete an import before trace preparation finishes.');
  }
  if (
    manifest.acknowledgedTraces !== manifest.counts.preparedTraces ||
    manifest.acknowledgedSpans !== manifest.counts.preparedSpans
  ) {
    throw new Error('Cannot complete an import while prepared traces remain unacknowledged.');
  }

  const completed =
    manifest.phase === 'complete'
      ? manifest
      : await writeTraceImportManifest(directory, {
          ...manifest,
          phase: 'complete',
          completedAt: new Date().toISOString(),
        });
  await rm(join(directory, PREPARED_TRACES_FILE), { force: true });
  return completed;
}
