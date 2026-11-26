/**
 * The importer contract: what an importer writes (items) and what its runner sends a host (flushes).
 * Items name things by `sourceId`, the source's own stable ID. They never name pages or paths;
 * the host's sink decides where an item lands and refuses what the binding doesn't own.
 */

/** A link from an item to another item of the same binding, resolved through the node map. */
export interface KnowledgeImportLink {
  sourceId: string;
  rel?: string;
}

/** Puts an item in the tree before its body is fetched (search skips it until the body lands). */
export interface KnowledgeImportDeclaration {
  /** Stable ID at the source, never the title. */
  sourceId: string;
  kind?: string;
  title: string;
  /** The parent's `sourceId`, or null/absent for the binding's target top. */
  parent?: string | null;
  /** Where the item waits while `parent` hasn't arrived: a holding item's `sourceId`. */
  fallbackParent?: string;
}

/**
 * One item with its content. A re-upsert whose title, description and body match the page writes
 * nothing; otherwise the item's fields replace the page's, including edits someone made in Knowledge.
 */
export interface KnowledgeImportItem extends KnowledgeImportDeclaration {
  description?: string;
  body: string;
  links?: KnowledgeImportLink[];
  /** Other refs (URLs, keys) that resolve links to this item. They never change placement. */
  aliases?: string[];
}

/** A buffered importer call, as sent in a flush. */
export type KnowledgeImporterOp =
  | { op: 'upsert'; item: KnowledgeImportItem }
  | { op: 'declare'; item: KnowledgeImportDeclaration }
  /** Only on a positive signal from the source (archived, trashed); never because an item was missing. */
  | { op: 'remove'; sourceId: string };

/** Staged `ctx.state.set` values. They commit with the ops of the same flush, or not at all. */
export type KnowledgeImporterState = Record<string, string>;

/** Why the sink refused one op. The rest of the flush still commits. */
export type KnowledgeImportRefusalReason =
  /** Another page took the item's path at the same moment, or the page found there changed before it was locked. */
  | 'occupied'
  /** The item's page or the pages on the way to it changed while the flush waited, or Knowledge refused the write (a move too large, for example). */
  | 'conflict'
  /** The op names something the binding can't hold (bad parent, malformed item). */
  | 'invalid';

export interface KnowledgeImportRefusal {
  sourceId: string;
  reason: KnowledgeImportRefusalReason;
}

export interface KnowledgeImportCounts {
  created: number;
  updated: number;
  unchanged: number;
  moved: number;
  removed: number;
  stubbed: number;
  refused: number;
}

/** What a host applied for one flush. A replay of the same flush returns the stored receipt. */
export interface KnowledgeImporterFlushReceipt extends Omit<KnowledgeImportCounts, 'refused'> {
  seq: number;
  refused: KnowledgeImportRefusal[];
  /**
   * The host has settle work left: pages to move under parents that arrived since, or links that
   * now resolve. The runner sends empty flushes (`ops: []`) while this is true and its budget
   * allows; each does one bounded slice. Stored with the receipt, so a replay returns the same value.
   */
  pending?: boolean;
}

/** One numbered batch from the runner. All or nothing. */
export interface KnowledgeImporterFlush {
  runId: string;
  generation: number;
  /** Exactly the host's last committed seq + 1. */
  seq: number;
  /** `knowledgeImporterFlushDigest({ ops, state })`. The host recomputes it and refuses a mismatch. */
  digest: string;
  ops: KnowledgeImporterOp[];
  state?: KnowledgeImporterState;
}

export type KnowledgeImporterRunOutcome = 'succeeded' | 'failed' | 'canceled';

/**
 * Failure codes an importer run can finish with. Fixed codes, no free text: a host may store and
 * show them, so an app's exception text never leaves the app's own logs.
 */
export type KnowledgeImporterErrorCode =
  | 'source_auth_failed'
  | 'source_unreachable'
  | 'source_rate_limited'
  | 'source_bad_response'
  | 'source_not_found'
  | 'settings_invalid'
  | 'credential_missing'
  | 'importer_missing_from_deploy'
  | 'importer_error'
  /** An op, or a state saved with `ctx.state.set`, is bigger than the host takes in one flush. */
  | 'flush_too_large'
  /** Hard deadline reached; the cursor stays behind what didn't land. */
  | 'stopped'
  /** Recorded by a host that ended the run: its runner stopped renewing the lease. */
  | 'lease_expired'
  /** Recorded by a host that ended the run: the run's deadline passed before it finished. */
  | 'deadline_exceeded';

export interface KnowledgeImporterRunError {
  code: KnowledgeImporterErrorCode;
  retryable?: boolean;
  /** The source's HTTP status, when the failure was a source response. */
  httpStatus?: number;
}

export interface KnowledgeImporterFinishRequest {
  runId: string;
  generation: number;
  outcome: KnowledgeImporterRunOutcome;
  /** Only `succeeded` with backlog is chained into another run. */
  backlog: boolean;
  /** The last seq the runner had a receipt for; must equal the host's committed seq. */
  lastSeq: number;
  error?: KnowledgeImporterRunError;
}

/** What a host recorded when a run ended. Counts are summed from flush receipts, never sent by the runner. */
export interface KnowledgeImporterRunReceipt {
  runId: string;
  outcome: KnowledgeImporterRunOutcome;
  backlog: boolean;
  lastSeq: number;
  error: { code: KnowledgeImporterErrorCode; retryable: boolean | null; httpStatus: number | null } | null;
  counts: KnowledgeImportCounts;
  /**
   * The host's decision to start another run right away: the app's `backlog`, or settle work left
   * after this run's settle flushes made progress. Schedulers chain on this, never on `backlog`.
   * Stored with the finish; a replay returns the same value.
   */
  chain: boolean;
  /**
   * The items the host refused in this run, as the runner received them in flush receipts: the first
   * 100, in order. `counts.refused` has the total. Set by the runner, not stored by the host, so a
   * receipt read back from the host has none.
   */
  refused?: KnowledgeImportRefusal[];
}
