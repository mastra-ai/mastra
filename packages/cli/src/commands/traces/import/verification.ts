import { isDeepStrictEqual } from 'node:util';
import {
  MAX_RECORDED_VERIFICATION_DIFFERENCES,
  readTraceImportManifest,
  writeTraceImportManifest,
} from './manifest.js';
import { completeTraceImport, readPreparedTraces } from './prepared-traces.js';
import { writeTraceImportReport } from './report.js';
import type {
  TraceImportManifest,
  TraceImportReport,
  TraceImportSpan,
  TraceImportTrace,
  TraceImportVerificationDifference,
} from './types.js';
import type { TraceImportStoredSpan, TraceImportVerifier } from './verifier.js';

export const DEFAULT_VERIFICATION_SAMPLE_SIZE = 10;
export const DEFAULT_VERIFICATION_MAX_ATTEMPTS = 6;

type Sleep = (milliseconds: number, signal?: AbortSignal) => Promise<void>;

export interface VerifyTraceImportOptions {
  directory: string;
  verifier: TraceImportVerifier;
  signal?: AbortSignal;
  limits?: {
    sampleSize?: number;
    maxAttempts?: number;
  };
  dependencies?: {
    sleep?: Sleep;
  };
}

const COMPARED_FIELDS = [
  'traceId',
  'parentSpanId',
  'name',
  'spanType',
  'isEvent',
  'startedAt',
  'endedAt',
  'error',
] as const;

type ComparedField = (typeof COMPARED_FIELDS)[number];

function comparable(field: ComparedField, value: unknown): unknown {
  if (field === 'startedAt' || field === 'endedAt') {
    return typeof value === 'string' ? Date.parse(value) : value;
  }
  if (field === 'parentSpanId' || field === 'error') return value ?? null;
  return value;
}

/** Compare only fields returned by Platform's lightweight trace endpoint. */
export function compareVerifiedTrace(
  expected: TraceImportSpan[],
  actual: TraceImportStoredSpan[],
): { matches: boolean; differences: TraceImportVerificationDifference[] } {
  const differences: TraceImportVerificationDifference[] = [];
  const traceId = expected[0]!.traceId;
  const actualById = new Map(actual.map(span => [span.spanId, span]));
  const expectedIds = new Set(expected.map(span => span.spanId));
  let matches = actualById.size === actual.length;

  const record = (spanId: string, fields: string[]) => {
    if (differences.length < MAX_RECORDED_VERIFICATION_DIFFERENCES) {
      differences.push({ traceId, spanId, fields });
    }
  };

  if (!matches) record(expected[0]!.spanId, ['duplicate_span_id']);

  for (const span of expected) {
    const stored = actualById.get(span.spanId);
    if (!stored) {
      matches = false;
      record(span.spanId, ['missing_span']);
      continue;
    }

    const changedFields = COMPARED_FIELDS.filter(
      field => !isDeepStrictEqual(comparable(field, span[field]), comparable(field, stored[field])),
    );
    if (changedFields.length > 0) {
      matches = false;
      record(span.spanId, changedFields);
    }
  }

  for (const span of actual) {
    if (!expectedIds.has(span.spanId)) {
      matches = false;
      record(span.spanId, ['unexpected_span']);
    }
  }

  return { matches, differences };
}

function sampleIndices(total: number, limit: number): Set<number> {
  if (total <= limit) return new Set(Array.from({ length: total }, (_, index) => index));
  if (limit === 1) return new Set([0]);
  return new Set(Array.from({ length: limit }, (_, index) => Math.floor((index * (total - 1)) / (limit - 1))));
}

async function readVerificationSample(
  directory: string,
  manifest: TraceImportManifest,
  sampleSize: number,
  signal?: AbortSignal,
): Promise<TraceImportTrace[]> {
  const selectedIndices = sampleIndices(manifest.counts.preparedTraces, sampleSize);
  const traces: TraceImportTrace[] = [];
  let traceCount = 0;
  let spanCount = 0;

  for await (const trace of readPreparedTraces(directory, signal)) {
    if (selectedIndices.has(traceCount)) traces.push(trace);
    traceCount++;
    spanCount += trace.spans.length;
  }

  if (traceCount !== manifest.counts.preparedTraces || spanCount !== manifest.counts.preparedSpans) {
    throw new Error('Prepared trace counts do not match the manifest. Start a new import.');
  }
  return traces;
}

function backoffMilliseconds(attempt: number): number {
  return Math.min(8_000, 500 * 2 ** attempt);
}

async function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }

    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function pauseVerification(
  directory: string,
  manifest: TraceImportManifest,
  status: 'timed-out' | 'unavailable' | 'mismatch',
  reason: string,
): Promise<TraceImportReport> {
  const paused = await writeTraceImportManifest(directory, {
    ...manifest,
    phase: 'paused',
    verification: { ...manifest.verification, status, reason },
  });
  return writeTraceImportReport(directory, paused);
}

/**
 * Verify a deterministic sample after all batches are acknowledged.
 *
 * A failed read-back pauses the import and keeps prepared data. Calling this
 * function again retries verification without re-uploading acknowledged work.
 */
export async function verifyTraceImport(options: VerifyTraceImportOptions): Promise<TraceImportReport> {
  let manifest = await readTraceImportManifest(options.directory);
  if (manifest.targetProjectId !== options.verifier.projectId) {
    throw new Error('Cannot verify prepared traces against a different target project.');
  }
  if (manifest.phase === 'complete') return writeTraceImportReport(options.directory, manifest);
  if (manifest.phase === 'preparing') {
    throw new Error('Cannot verify an import before trace preparation finishes.');
  }
  if (
    manifest.acknowledgedTraces !== manifest.counts.preparedTraces ||
    manifest.acknowledgedSpans !== manifest.counts.preparedSpans
  ) {
    throw new Error('Cannot verify an import while prepared traces remain unacknowledged.');
  }

  const sampleSize = options.limits?.sampleSize ?? DEFAULT_VERIFICATION_SAMPLE_SIZE;
  const maxAttempts = options.limits?.maxAttempts ?? DEFAULT_VERIFICATION_MAX_ATTEMPTS;
  if (!Number.isSafeInteger(sampleSize) || sampleSize < 1) {
    throw new Error('The verification sample size must be a positive integer.');
  }
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('The verification attempt limit must be a positive integer.');
  }

  const traces = await readVerificationSample(options.directory, manifest, sampleSize, options.signal);
  manifest = await writeTraceImportManifest(options.directory, {
    ...manifest,
    phase: 'verifying',
    verification: {
      status: 'not-performed',
      sampledTraces: traces.length,
      verifiedTraces: 0,
      queryAttempts: 0,
      differences: [],
    },
  });

  const wait = options.dependencies?.sleep ?? sleep;
  let sawMismatch = false;
  let sawTimeout = false;

  try {
    for (const trace of traces) {
      const traceId = trace.spans[0]!.traceId;
      let verified = false;
      let differences: TraceImportVerificationDifference[] = [];

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        options.signal?.throwIfAborted();
        const result = await options.verifier.readTrace(traceId, { signal: options.signal });
        manifest.verification.queryAttempts++;

        if (result.kind === 'unavailable') {
          return pauseVerification(options.directory, manifest, 'unavailable', result.reason);
        }
        if (result.kind === 'found') {
          const comparison = compareVerifiedTrace(trace.spans, result.spans);
          differences = comparison.differences;
          if (comparison.matches) {
            verified = true;
            break;
          }
        }

        if (attempt + 1 < maxAttempts) {
          const backoff = backoffMilliseconds(attempt);
          const delay =
            result.kind === 'retryable' && result.retryAfterMs !== undefined
              ? Math.max(backoff, result.retryAfterMs)
              : backoff;
          await wait(delay, options.signal);
        }
      }

      if (verified) {
        manifest.verification.verifiedTraces++;
      } else if (differences.length > 0) {
        sawMismatch = true;
        manifest.verification.differences.push(
          ...differences.slice(0, MAX_RECORDED_VERIFICATION_DIFFERENCES - manifest.verification.differences.length),
        );
      } else {
        sawTimeout = true;
        if (manifest.verification.differences.length < MAX_RECORDED_VERIFICATION_DIFFERENCES) {
          manifest.verification.differences.push({ traceId, fields: ['not_queryable'] });
        }
      }
    }
  } catch (cause) {
    await pauseVerification(
      options.directory,
      manifest,
      'unavailable',
      options.signal?.aborted ? 'Verification was interrupted.' : 'Platform read-back verification failed.',
    );
    throw cause;
  }

  if (sawMismatch) {
    return pauseVerification(
      options.directory,
      manifest,
      'mismatch',
      'One or more sampled traces differ from the prepared trace structure.',
    );
  }
  if (sawTimeout) {
    return pauseVerification(
      options.directory,
      manifest,
      'timed-out',
      'One or more sampled traces were not queryable before the verification retry limit.',
    );
  }

  manifest = await writeTraceImportManifest(options.directory, {
    ...manifest,
    verification: { ...manifest.verification, status: 'verified' },
  });
  const completed = await completeTraceImport(options.directory);
  return writeTraceImportReport(options.directory, completed);
}
