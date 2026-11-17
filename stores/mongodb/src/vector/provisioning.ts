import { MongoServerError } from 'mongodb';
import type { Document } from 'mongodb';
import { idFor, owns, uses } from './ownership';
import type { OwnershipView } from './ownership';

/** The driver types listSearchIndexes() rows as `{ name }`; these are the fields this store reads. */
export type SearchIndexRow = { name: string; id?: string; status?: string; latestDefinition?: Document };

/** Which protocol step lists a search index name (see `MongoDBVector.listSearchIndexRows`). */
export type ListPhase = 'P1' | 'P3a' | 'P5' | 'reconciler' | 'orphan' | 'claim' | 'delete' | 'tofu';

/** What a call's P0 registry write left: the registration's lifetime and the call's rollback pin (I4). */
export interface P0Pin {
  generation: string;
  claimToken: string;
  rev: number;
}

/**
 * The update that undoes a P0 write of `written` over `previous` (§3.9): each field P0 wrote gets
 * its previous value back, or is removed when `previous` lacked it. Nothing else is touched.
 */
export function rollbackRestore(previous: Document, written: Document): { $set: Document; $unset: Record<string, ''> } {
  const $set: Document = {};
  const $unset: Record<string, ''> = {};
  for (const key of Object.keys(written)) {
    if (previous[key] === undefined) $unset[key] = '';
    else $set[key] = previous[key];
  }
  return { $set, $unset };
}

export const LEASE_MS = 300_000;
export const CREATE_TIMEOUT_MS = 60_000;
/** ObjectId timestamps are second-truncated; an id is foreign by timestamp only when MORE than this before creatingAt. */
export const ID_TIMESTAMP_MARGIN_MS = 30_000;
export const RECONCILE_BATCH = 20;

export type P4Outcome =
  | { kind: 'ok'; id: string }
  | { kind: 'refused'; error: unknown }
  | { kind: 'unknown'; error: unknown };

export type Verdict =
  | { kind: 'proven'; id: string }
  | { kind: 'foreign'; byTimestamp: boolean }
  | { kind: 'not-created' }
  | { kind: 'pending' }
  | { kind: 'uncertain'; candidateId: string };

/** A listing row that is present and not on its way out. */
export function isLiveRow(row: SearchIndexRow | undefined): boolean {
  return !!row && row.status !== 'DELETING' && row.status !== 'DOES_NOT_EXIST';
}

const HEX24 = /^[0-9a-f]{24}$/i;

/** Creation time embedded in an ObjectId-shaped id; undefined for anything else (Atlas Local ids may not be ObjectIds). */
export function idTimestampMs(id: string): number | undefined {
  return HEX24.test(id) ? parseInt(id.slice(0, 8), 16) * 1000 : undefined;
}

/** True only when both ids are 24-hex and `a` sorts after `b`; false otherwise. */
export function isNewerId(a: string, b: string): boolean {
  return HEX24.test(a) && HEX24.test(b) && a.toLowerCase() > b.toLowerCase();
}

/** Server codes after which the create may or may not have landed: timeouts, shutdown, step-down, unreachable host. */
export const MAYBE_LANDED_CODES: readonly number[] = [
  6, 7, 50, 89, 91, 189, 262, 9001, 10107, 11600, 11602, 13435, 13436,
];

export function p4OutcomeOf(error: unknown): P4Outcome {
  return error instanceof MongoServerError && typeof error.code === 'number' && !MAYBE_LANDED_CODES.includes(error.code)
    ? { kind: 'refused', error }
    : { kind: 'unknown', error };
}

/** The §3.1 P5 table plus the id-timestamp rule. */
export function classify(p4: P4Outcome, row: SearchIndexRow | undefined, creatingAt: Date): Verdict {
  if (p4.kind === 'refused') return { kind: 'not-created' };
  // Rows of any status count as present at P5 (a dying row still holds the name).
  if (p4.kind === 'unknown') return row?.id ? { kind: 'uncertain', candidateId: row.id } : { kind: 'pending' };
  if (row && row.id !== p4.id) return { kind: 'foreign', byTimestamp: false };
  const ts = idTimestampMs(p4.id);
  if (ts !== undefined && ts < creatingAt.getTime() - ID_TIMESTAMP_MARGIN_MS)
    return { kind: 'foreign', byTimestamp: true };
  return { kind: 'proven', id: p4.id };
}

export type JournalState = 'intent' | 'creating' | 'created' | 'orphaned' | 'uncertain';

/** One physical-index provisioning attempt in `__mastra_vector_ops__` (§2.2). */
export interface JournalDoc {
  /** `${opToken}:${role}`, where `opToken` is the op's P0 `claimToken`. */
  _id: string;
  indexName: string;
  generation: string;
  collectionName: string;
  name: string;
  type: 'vectorSearch' | 'search';
  role: 'vector' | 'text';
  state: JournalState;
  preListAbsent?: true;
  creatingAt?: Date;
  indexId?: string;
  candidateId?: string;
  /** Set by §3.8 step 3 when it decided to drop (R11): later cleaners go straight to the drop. */
  dropDecided?: true;
  leaseUntil: Date;
  createdAt: Date;
}

/**
 * §4.2 for an abandoned `creating` doc: an absent name, or a row whose id another record holds or
 * whose id time is more than the margin before `creatingAt`, is not this attempt's, so the doc goes.
 * Anything else may be ours and is kept as uncertain. Rows of any status count as present.
 */
export function resolveCreating(
  row: SearchIndexRow | undefined,
  creatingAt: Date,
  heldIds: Set<string>,
): { action: 'delete'; byTimestamp: boolean } | { action: 'uncertain'; candidateId: string } {
  if (!row?.id || heldIds.has(row.id)) return { action: 'delete', byTimestamp: false };
  const ts = idTimestampMs(row.id);
  if (ts !== undefined && ts < creatingAt.getTime() - ID_TIMESTAMP_MARGIN_MS)
    return { action: 'delete', byTimestamp: true };
  return { action: 'uncertain', candidateId: row.id };
}

export type OrphanPlan =
  | { kind: 'release'; owners: { toId: string; rewriteId?: string }[] }
  | { kind: 'transfer'; toId: string; field: 'ownsVectorIndex' | 'ownsTextIndex'; id: string }
  | { kind: 'forget' }
  | { kind: 'drop' };

/**
 * §3.8 step 3 for proven incarnation `R` of `name`, given its live `users` and the listed id
 * `observed`. Any user blocks the drop (I11a). Owners come first: each is released, and rewritten
 * to R only when the listing confirms R (I11b). Otherwise the lowest-`_id` user gets R, again only
 * when the listing shows R; else nothing is transferred, as R is gone and the name may be a stranger's.
 */
export function planOrphanCleanup(
  name: string,
  R: string,
  observed: string | undefined,
  users: OwnershipView[],
): OrphanPlan {
  const owners = users.filter(u => owns(u, name));
  if (owners.length)
    return {
      kind: 'release',
      owners: owners.map(o => ({ toId: o._id, ...(observed === R && idFor(o, name) !== R ? { rewriteId: R } : {}) })),
    };
  const [recipient] = users.filter(u => uses(u, name)).sort((a, b) => (a._id < b._id ? -1 : a._id > b._id ? 1 : 0));
  if (!recipient) return { kind: 'drop' };
  if (observed !== R) return { kind: 'forget' };
  const field = recipient.textSearchIndexName === name ? 'ownsTextIndex' : 'ownsVectorIndex';
  return { kind: 'transfer', toId: recipient._id, field, id: R };
}
