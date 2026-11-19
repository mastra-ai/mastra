import type {
  KnowledgeImporterErrorCode,
  KnowledgeImporterFinishRequest,
  KnowledgeImporterFlush,
  KnowledgeImporterFlushReceipt,
  KnowledgeImporterOp,
  KnowledgeImporterRunReceipt,
  KnowledgeImporterState,
} from './types';

export interface KnowledgeImporterStartRunOptions {
  /** A caller-chosen run ID, e.g. the one a scheduler already recorded. */
  runId?: string;
  /** De-duplicates fires of one schedule tick, e.g. `${bindingId}:${scheduledAt}`. */
  fireKey?: string;
  /** Epoch ms after which the host refuses the run's flushes. */
  deadline?: number;
}

export type KnowledgeImporterRunStart =
  | {
      status: 'started';
      runId: string;
      generation: number;
      /** The state the last committed flush left. */
      state: KnowledgeImporterState;
      /** 0 before the first flush. */
      lastSeq: number;
    }
  /** Another run of the binding is going; the host recorded this one as skipped. */
  | { status: 'skipped'; runId: string };

/**
 * The runner's only way to Knowledge. Core's local host applies flushes to the app's own storage;
 * a remote host (hosted Knowledge) applies them on its server. Both must pass
 * `importerHostConformance`.
 *
 * Rules every host keeps:
 * - `flush` is all or nothing, and its `state` commits with its ops in one transaction.
 * - A flush's seq is exactly the last committed seq + 1. The host recomputes the digest and refuses
 *   a mismatch before applying anything.
 * - Flush replay identity is `(runId, generation, seq)`: the same digest returns the stored
 *   receipt and applies nothing; a different digest is refused.
 * - `finishRun` needs `lastSeq` equal to the committed seq and is valid once. A replay whose
 *   normalized request (`normalizeKnowledgeImporterFinish`) equals the stored one returns the
 *   stored receipt; any other is refused, and the stored outcome doesn't change.
 * - After a run ends (finished, canceled or expired) a new seq is refused, while an exact replay
 *   of a committed seq still returns its receipt.
 * - Run counts are summed from flush receipts.
 *
 * Refusals throw `KnowledgeImporterHostConflictError`.
 *
 * @experimental
 */
export interface KnowledgeImporterHost {
  startRun(bindingId: string, options?: KnowledgeImporterStartRunOptions): Promise<KnowledgeImporterRunStart>;
  flush(flush: KnowledgeImporterFlush): Promise<KnowledgeImporterFlushReceipt>;
  /** Keeps the run alive; `cancel: true` tells the runner to stop without saving more state. */
  heartbeat(runId: string, generation: number): Promise<{ cancel: boolean }>;
  finishRun(request: KnowledgeImporterFinishRequest): Promise<KnowledgeImporterRunReceipt>;
}

export type KnowledgeImporterHostConflictCode =
  /** seq isn't the committed seq + 1, or finish's lastSeq isn't the committed seq. */
  | 'seq_mismatch'
  /** The digest doesn't match the flush's content, or a committed seq is replayed with other content. */
  | 'digest_mismatch'
  /** The run belongs to an older generation, or the binding's writer moved on. */
  | 'stale_generation'
  /** The run has ended, been canceled, expired or never started. */
  | 'run_not_active'
  /** A finish replay that differs from the recorded finish. */
  | 'finish_mismatch';

/** A host refused a flush or a finish (409 over HTTP). Retrying the same request won't help. @experimental */
export class KnowledgeImporterHostConflictError extends Error {
  readonly status = 409;
  constructor(
    readonly code: KnowledgeImporterHostConflictCode,
    message: string,
  ) {
    super(message);
    this.name = 'KnowledgeImporterHostConflictError';
  }
}

export const KNOWLEDGE_IMPORTER_ERROR_CODES = [
  'source_auth_failed',
  'source_unreachable',
  'source_rate_limited',
  'source_bad_response',
  'source_not_found',
  'settings_invalid',
  'credential_missing',
  'importer_missing_from_deploy',
  'importer_error',
  'stopped',
] as const satisfies readonly KnowledgeImporterErrorCode[];

export type NormalizedKnowledgeImporterFinish = Omit<KnowledgeImporterRunReceipt, 'runId' | 'counts'>;

/**
 * The finish request as a host stores and compares it: missing optional fields become null.
 * Throws a TypeError for a request no host should accept.
 */
export function normalizeKnowledgeImporterFinish(
  request: KnowledgeImporterFinishRequest,
): NormalizedKnowledgeImporterFinish {
  const { outcome, backlog, lastSeq, error } = request;
  if (outcome !== 'succeeded' && outcome !== 'failed' && outcome !== 'canceled') {
    throw new TypeError(`Unknown importer run outcome "${String(outcome)}".`);
  }
  if (typeof backlog !== 'boolean') throw new TypeError('Importer finish needs backlog: true or false.');
  if (backlog && outcome !== 'succeeded') throw new TypeError('Only a succeeded importer run can report backlog.');
  if (!Number.isSafeInteger(lastSeq) || lastSeq < 0) throw new TypeError('Importer finish needs lastSeq >= 0.');
  if ((outcome === 'failed') !== (error !== undefined)) {
    throw new TypeError('A failed importer run needs an error code, and only a failed run has one.');
  }
  if (!error) return { outcome, backlog, lastSeq, error: null };
  if (!(KNOWLEDGE_IMPORTER_ERROR_CODES as readonly string[]).includes(error.code)) {
    throw new TypeError(`Unknown importer error code "${String(error.code)}".`);
  }
  if (error.retryable !== undefined && typeof error.retryable !== 'boolean') {
    throw new TypeError('Importer error retryable must be a boolean.');
  }
  const { httpStatus } = error;
  if (httpStatus !== undefined && (!Number.isInteger(httpStatus) || httpStatus < 100 || httpStatus > 599)) {
    throw new TypeError('Importer error httpStatus must be an HTTP status code.');
  }
  return {
    outcome,
    backlog,
    lastSeq,
    error: { code: error.code, retryable: error.retryable ?? null, httpStatus: httpStatus ?? null },
  };
}

/**
 * RFC 8785 (JCS) canonical JSON: object members sorted by UTF-16 code units, no whitespace, numbers
 * and strings as ECMAScript serializes them. Members whose value is undefined are left out, as
 * JSON.stringify leaves them out of what goes over the wire.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError('Canonical JSON has no NaN or Infinity.');
      return JSON.stringify(value);
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map(item => (item === undefined ? 'null' : canonicalJson(item))).join(',')}]`;
      }
      const record = value as Record<string, unknown>;
      const members = Object.keys(record)
        .filter(key => record[key] !== undefined)
        .sort()
        .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`);
      return `{${members.join(',')}}`;
    }
    default:
      throw new TypeError(`Canonical JSON can't hold a ${typeof value}.`);
  }
}

/**
 * A flush's digest: lowercase hex SHA-256 of the canonical JSON of `{ ops, state }`, with an absent
 * `state` as null. Runners send it; hosts recompute it from the body they received.
 */
export async function knowledgeImporterFlushDigest(flush: {
  ops: KnowledgeImporterOp[];
  state?: KnowledgeImporterState;
}): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson({ ops: flush.ops, state: flush.state ?? null }));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
