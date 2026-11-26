import type {
  KnowledgeImporterErrorCode,
  KnowledgeImporterFinishRequest,
  KnowledgeImporterFlush,
  KnowledgeImporterFlushReceipt,
  KnowledgeImporterOp,
  KnowledgeImporterRunReceipt,
  KnowledgeImporterState,
} from './types';

/**
 * Run options from the host's trusted caller. A remote host may ignore them: its run ID, fire key
 * and deadline come from the run it dispatched.
 */
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
      /**
       * The binding as the host recorded it for this run. A remote host sends it because the app
       * trusts only what the host returns here; the runner picks the importer from it.
       */
      binding?: KnowledgeImporterRunBinding;
      /**
       * The largest flush request the host takes, in bytes of the request encoded as JSON. The
       * runner keeps under the lower of this and its own `maxFlushBytes`. Ignored unless a positive
       * whole number.
       */
      maxFlushBytes?: number;
    }
  /** Another run of the binding is going; the host recorded this one as skipped. */
  | { status: 'skipped'; runId: string };

/**
 * A run's binding as a host hands it over. The runner picks the definition by `importer`, checks
 * `settings` with `parseSettings` (failure: `settings_invalid`) and `credentials` with
 * `checkCredentials` (failure: `credential_missing`). Credential values are resolved by the host
 * side in the app's own process; they never come from a remote server.
 */
export interface KnowledgeImporterRunBinding {
  id: string;
  /** The definition's id. */
  importer: string;
  /** `<scope>#<path>`. */
  target: string;
  settings: unknown;
  credentials: Record<string, string>;
}

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
 * Refusals throw `KnowledgeImporterHostConflictError`. Any other host failure throws
 * `KnowledgeImporterHostError` with the HTTP status when there is one: the runner resends the same
 * flush (same seq and digest) after a 5xx or a network error, and ends the run on any other.
 *
 * @experimental
 */
export interface KnowledgeImporterHost {
  startRun(bindingId: string, options?: KnowledgeImporterStartRunOptions): Promise<KnowledgeImporterRunStart>;
  flush(flush: KnowledgeImporterFlush): Promise<KnowledgeImporterFlushReceipt>;
  /**
   * Keeps the run alive; `cancel: true` tells the runner to stop without saving more state. A host
   * that enforces a lease may instead refuse a heartbeat for a run it no longer holds, with
   * `KnowledgeImporterHostConflictError` (`stale_generation` or `run_not_active`). The runner
   * ignores a failed heartbeat; its next flush or finish gets the same refusal and ends the run.
   */
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
  'flush_too_large',
  'stopped',
  'lease_expired',
  'deadline_exceeded',
] as const satisfies readonly KnowledgeImporterErrorCode[];

export type NormalizedKnowledgeImporterFinish = Omit<KnowledgeImporterRunReceipt, 'runId' | 'counts' | 'chain'>;

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
  const hasError = error !== undefined && error !== null;
  if ((outcome === 'failed') !== hasError) {
    throw new TypeError('A failed importer run needs an error code, and only a failed run has one.');
  }
  if (!hasError) return { outcome, backlog, lastSeq, error: null };
  if (!isPlainObject(error)) throw new TypeError('Importer finish error must be an object.');
  const unknownErrorKeys = Object.keys(error).filter(key => !['code', 'retryable', 'httpStatus'].includes(key));
  if (unknownErrorKeys.length) throw new TypeError(`Importer finish error has unknown field "${unknownErrorKeys[0]}".`);
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
 * JSON.stringify leaves them out of what goes over the wire; array holes and undefined items are
 * null, as JSON.stringify writes them. Strings with a lone UTF-16 surrogate are refused (RFC 8785
 * §3.2.2.2).
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
      return JSON.stringify(wellFormed(value));
    case 'object': {
      if (Array.isArray(value)) {
        // Index every slot, as JSON.stringify does: a hole or undefined is null on the wire.
        const items: string[] = [];
        for (let index = 0; index < value.length; index++) {
          const item: unknown = value[index];
          items.push(item === undefined ? 'null' : canonicalJson(item));
        }
        return `[${items.join(',')}]`;
      }
      const record = value as Record<string, unknown>;
      const members = Object.keys(record)
        .filter(key => record[key] !== undefined)
        .sort()
        .map(key => `${JSON.stringify(wellFormed(key))}:${canonicalJson(record[key])}`);
      return `{${members.join(',')}}`;
    }
    default:
      throw new TypeError(`Canonical JSON can't hold a ${typeof value}.`);
  }
}

/**
 * A flush's digest: lowercase hex SHA-256 of the canonical JSON of `{ ops, state }`, with an absent
 * `state` as null. Runners send it; hosts recompute it from the body they received. The body is
 * checked with `parseKnowledgeImporterFlushBody` first, so only payloads that survive a JSON round
 * trip unchanged get a digest.
 */
export async function knowledgeImporterFlushDigest(flush: {
  ops: KnowledgeImporterOp[];
  state?: KnowledgeImporterState;
}): Promise<string> {
  const { ops, state } = parseKnowledgeImporterFlushBody(flush);
  const bytes = new TextEncoder().encode(canonicalJson({ ops, state: state ?? null }));
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

function wellFormed(value: string): string {
  if (LONE_SURROGATE.test(value)) throw new TypeError('Canonical JSON refuses strings with a lone UTF-16 surrogate.');
  return value;
}

type FieldKind = 'string' | 'nonEmpty' | 'nullableString' | 'links' | 'aliases';

const DECLARATION_FIELDS: Record<string, { kind: FieldKind; required?: boolean }> = {
  sourceId: { kind: 'nonEmpty', required: true },
  kind: { kind: 'string' },
  title: { kind: 'string', required: true },
  parent: { kind: 'nullableString' },
  fallbackParent: { kind: 'nonEmpty' },
};

const ITEM_FIELDS: Record<string, { kind: FieldKind; required?: boolean }> = {
  ...DECLARATION_FIELDS,
  description: { kind: 'string' },
  body: { kind: 'string', required: true },
  links: { kind: 'links' },
  aliases: { kind: 'aliases' },
};

function checkString(value: unknown, where: string, nonEmpty = false): string {
  if (typeof value !== 'string') throw new TypeError(`${where} must be a string.`);
  if (nonEmpty && !value) throw new TypeError(`${where} must not be empty.`);
  return wellFormed(value);
}

function checkDenseArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${where} must be an array.`);
  for (let index = 0; index < value.length; index++) {
    if (!(index in value)) throw new TypeError(`${where}[${index}] is empty.`);
  }
  return value;
}

function checkFields<T>(
  value: unknown,
  fields: Record<string, { kind: FieldKind; required?: boolean }>,
  where: string,
): T {
  if (!isPlainObject(value)) throw new TypeError(`${where} must be an object.`);
  const out: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(fields, key)) throw new TypeError(`${where} has unknown field "${key}".`);
  }
  for (const [key, { kind, required }] of Object.entries(fields)) {
    const field = value[key];
    const at = `${where}.${key}`;
    if (field === undefined) {
      if (required) throw new TypeError(`${at} is required.`);
      continue;
    }
    switch (kind) {
      case 'string':
        out[key] = checkString(field, at);
        break;
      case 'nonEmpty':
        out[key] = checkString(field, at, true);
        break;
      case 'nullableString':
        out[key] = field === null ? null : checkString(field, at, true);
        break;
      case 'aliases':
        out[key] = checkDenseArray(field, at).map((alias, index) => checkString(alias, `${at}[${index}]`, true));
        break;
      case 'links':
        out[key] = checkDenseArray(field, at).map((link, index) =>
          checkFields(
            link,
            { sourceId: { kind: 'nonEmpty', required: true }, rel: { kind: 'string' } },
            `${at}[${index}]`,
          ),
        );
        break;
    }
  }
  return { ...out } as T;
}

/**
 * Checks a flush body the way every host and runner must before hashing or applying it: known ops
 * and fields only, strings where strings belong, no array holes, no lone surrogates, string-only
 * state. Returns a copy with undefined optional fields left out, so what passes hashes the same
 * before and after a JSON round trip. Throws a TypeError otherwise.
 *
 * @experimental
 */
export function parseKnowledgeImporterFlushBody(body: { ops: unknown; state?: unknown }): {
  ops: KnowledgeImporterOp[];
  state?: KnowledgeImporterState;
} {
  const ops = checkDenseArray(body.ops, 'ops').map((op, index): KnowledgeImporterOp => {
    const where = `ops[${index}]`;
    if (!isPlainObject(op)) throw new TypeError(`${where} must be an object.`);
    switch (op.op) {
      case 'upsert':
      case 'declare': {
        const extra = Object.keys(op).find(key => key !== 'op' && key !== 'item');
        if (extra) throw new TypeError(`${where} has unknown field "${extra}".`);
        const fields = op.op === 'upsert' ? ITEM_FIELDS : DECLARATION_FIELDS;
        return { op: op.op, item: checkFields(op.item, fields, `${where}.item`) } as KnowledgeImporterOp;
      }
      case 'remove': {
        const extra = Object.keys(op).find(key => key !== 'op' && key !== 'sourceId');
        if (extra) throw new TypeError(`${where} has unknown field "${extra}".`);
        return { op: 'remove', sourceId: checkString(op.sourceId, `${where}.sourceId`, true) };
      }
      default:
        throw new TypeError(`${where}.op must be "upsert", "declare" or "remove".`);
    }
  });
  if (body.state === undefined || body.state === null) return { ops };
  if (!isPlainObject(body.state)) throw new TypeError('state must be an object of strings.');
  // Object.fromEntries defines own properties, so a JSON key like "__proto__" is kept as data.
  const state: KnowledgeImporterState = Object.fromEntries(
    Object.entries(body.state).map(([key, value]) => [wellFormed(key), checkString(value, `state.${key}`)]),
  );
  return { ops, state };
}
