/**
 * Importer bookkeeping a Knowledge store keeps next to its pages: bindings, the source-to-page node
 * map, cursor state, runs, flush receipts, per-run changes and the writer guard. Reached through
 * {@link KnowledgeStorage.importers}, so on a transaction view it writes in the same transaction as
 * the page writes it records.
 *
 * Source IDs and state keys are opaque: stored and compared byte for byte, never case-folded.
 *
 * @experimental
 */

export interface KnowledgeImporterBindingRecord {
  id: string;
  /** The importer definition's id. */
  importer: string;
  /** `<scope>#<path>`. */
  target: string;
  /**
   * The page the first applying flush created at `target`, or null before that and after a rebind.
   * The binding owns this page only while it is still live at `target`.
   */
  anchorPageId: string | null;
  createdAt: Date;
}

export interface KnowledgeImporterNodeRecord {
  bindingId: string;
  sourceId: string;
  pageId: string;
  kind: string | null;
  parentSourceId: string | null;
  aliases: string[];
  unresolvedLinks: string[];
  /**
   * The links the item declared, by target source ID, resolved or not. The store indexes them by
   * target, so {@link KnowledgeImportersStorage.listLinkingNodes} finds the nodes linking to a page.
   */
  links: KnowledgeImporterNodeLink[];
  /**
   * The links section the sink appended to the page body, exactly as written, or null when it wrote
   * none. Everything in the body before it is the source's own text, kept byte for byte.
   */
  linkSection: string | null;
  /** The page was kept as a stub after the source removed it, because pages are nested under it. */
  stub: boolean;
  /**
   * The page was already at the item's path when the binding first wrote the item, and the binding
   * took it over. Removed from the source, it is kept as a stub, never deleted.
   */
  adopted: boolean;
  /**
   * The sink still owes this node follow-up work: it sits away from its source parent (which hadn't
   * arrived), or it has links that didn't resolve. Settle passes visit only these.
   */
  unsettled: boolean;
  updatedAt: Date;
}

export interface KnowledgeImporterNodeLink {
  sourceId: string;
  rel: string | null;
}

export type KnowledgeImporterRunStatus = 'running' | 'succeeded' | 'failed' | 'canceled' | 'skipped';

export interface KnowledgeImporterRunRecord {
  id: string;
  bindingId: string;
  generation: number;
  status: KnowledgeImporterRunStatus;
  fireKey: string | null;
  /** Flushes after this are refused. */
  deadlineAt: Date | null;
  cancelRequestedAt: Date | null;
  /** Last heartbeat from the runner; null before the first. A host reclaims a run whose heartbeat is stale. */
  heartbeatAt: Date | null;
  /** 0 before the first flush. */
  lastSeq: number;
  /** The normalized finish request, compared on replay. Null while running. */
  finish: unknown | null;
  /** Summed from flush receipts. */
  counts: Record<string, number>;
  startedAt: Date;
  completedAt: Date | null;
}

export interface KnowledgeImporterFlushRecord {
  runId: string;
  generation: number;
  seq: number;
  digest: string;
  receipt: unknown;
}

export type KnowledgeImporterChangeKind = 'created' | 'updated' | 'moved' | 'removed' | 'stubbed';

export interface KnowledgeImporterRunChangeRecord {
  runId: string;
  sourceId: string;
  pageId: string | null;
  change: KnowledgeImporterChangeKind;
  title: string;
  path: string;
}

export interface KnowledgeImporterWriterGuard {
  /** OSS hosts only ever write as `'new'`. */
  activePath: string;
  generation: number;
  firstWriteAt: Date | null;
}

export type KnowledgeImporterRunStartResult =
  | { status: 'started'; run: KnowledgeImporterRunRecord }
  /** Another run of the binding is going; this one was recorded as skipped. */
  | { status: 'skipped'; run: KnowledgeImporterRunRecord }
  /** The fire key was already used; nothing new was recorded. */
  | { status: 'duplicate'; run: KnowledgeImporterRunRecord };

export interface KnowledgeImporterPage<T> {
  items: T[];
  /** Pass as `after` for the next page; null on the last. */
  next: string | null;
}

/** A binding was registered again with a different importer or target. */
export class KnowledgeImporterBindingConflictError extends Error {
  constructor(readonly bindingId: string) {
    super(`Knowledge importer binding ${bindingId} already exists with a different importer or target`);
    this.name = 'KnowledgeImporterBindingConflictError';
  }
}

/** A conditional run write found the run in another state (see each method). */
export class KnowledgeImporterRunStateError extends Error {
  constructor(
    readonly runId: string,
    /** `generation`: the run's own row; `stale_guard`: the writer guard has moved past the run. */
    readonly reason: 'not_found' | 'not_running' | 'generation' | 'stale_guard' | 'seq',
  ) {
    super(`Knowledge importer run ${runId} refused the write: ${reason}`);
    this.name = 'KnowledgeImporterRunStateError';
  }
}

/** @experimental */
export abstract class KnowledgeImportersStorage {
  /**
   * Creates the importer tables if needed, in the same namespace as the store's pages: explicit
   * provisioning, like `initKnowledge()`. Idempotent; never touches page tables. Whoever calls it
   * automatically must skip it when storage init is disabled. No other method issues DDL: against
   * unprovisioned tables they fail.
   */
  abstract init(): Promise<void>;
  /** Deletes every importer row. Tests only. */
  abstract dangerouslyClearAll(): Promise<void>;

  /** `created` the first time, `unchanged` after; a different importer or target throws {@link KnowledgeImporterBindingConflictError}. */
  abstract registerBinding(input: {
    id: string;
    importer: string;
    target: string;
  }): Promise<{ status: 'created' | 'unchanged'; binding: KnowledgeImporterBindingRecord }>;
  abstract getBinding(id: string): Promise<KnowledgeImporterBindingRecord | null>;
  /**
   * Sets the binding's anchor to `pageId` only if it is currently `expected`; returns whether it did.
   * False for a missing binding.
   */
  abstract setBindingAnchor(input: {
    bindingId: string;
    expected: string | null;
    pageId: string | null;
  }): Promise<boolean>;
  abstract listBindings(): Promise<KnowledgeImporterBindingRecord[]>;
  /**
   * Forgets a binding: deletes its row with its nodes, their links, its state, and its runs with their
   * flushes and changes. Pages are not touched; they stay as ordinary pages. No-op for an unknown id.
   */
  abstract retireBinding(id: string): Promise<void>;

  /**
   * Starts a run at the writer guard's generation. At most one run per binding is `running`; a
   * second is recorded as `skipped`. A `fireKey` already used for the binding returns that run as
   * `duplicate` and records nothing.
   */
  abstract startRun(input: {
    bindingId: string;
    runId: string;
    generation: number;
    fireKey?: string;
    deadlineAt?: Date;
  }): Promise<KnowledgeImporterRunStartResult>;
  abstract getRun(runId: string): Promise<KnowledgeImporterRunRecord | null>;
  /** Newest first. */
  abstract listRuns(bindingId: string, options?: { limit?: number }): Promise<KnowledgeImporterRunRecord[]>;
  /** Sets `cancelRequestedAt` on a running run; returns the run, or null when none is running. */
  abstract requestCancel(runId: string): Promise<KnowledgeImporterRunRecord | null>;
  /** Sets `heartbeatAt` on a running run; returns the run (with any cancel request), or null when it isn't running. */
  abstract heartbeat(runId: string): Promise<KnowledgeImporterRunRecord | null>;
  /**
   * Ends a running run as `failed` (or `status`) with `finish`, whatever its seq or generation: for a
   * host reclaiming a run whose runner went away. Returns the run, or null when it wasn't running.
   * Its later flushes and finish are refused as `not_running`.
   */
  abstract abandonRun(input: {
    runId: string;
    finish: unknown;
    status?: 'failed' | 'canceled';
  }): Promise<KnowledgeImporterRunRecord | null>;
  /**
   * The store's clock, which every run timestamp it writes (`startedAt`, `heartbeatAt`) comes from:
   * a host compares leases against it rather than its own clock. Defaults to this process's clock,
   * which is the store's own for an in-process store.
   */
  async now(): Promise<Date> {
    return new Date();
  }
  /**
   * Inside a transaction: reads the run and locks its row until commit (take the writer guard lock
   * first). Null when there's no such run.
   */
  abstract lockRun(runId: string): Promise<KnowledgeImporterRunRecord | null>;

  abstract getFlush(runId: string, generation: number, seq: number): Promise<KnowledgeImporterFlushRecord | null>;
  /**
   * Records a flush and advances the run to `seq`, adding `counts`. Only when the run is `running`
   * at `generation` with `lastSeq = seq - 1`, and the writer guard is still at `generation` (read
   * under the lock the caller took with {@link lockWriterGuard}); otherwise throws
   * {@link KnowledgeImporterRunStateError} and writes nothing.
   */
  abstract recordFlush(input: KnowledgeImporterFlushRecord & { counts: Record<string, number> }): Promise<void>;
  /**
   * Ends a running run at `generation` whose `lastSeq` equals `lastSeq`, with the writer guard
   * still at `generation`; otherwise throws
   * {@link KnowledgeImporterRunStateError}.
   */
  abstract finishRun(input: {
    runId: string;
    generation: number;
    lastSeq: number;
    status: Exclude<KnowledgeImporterRunStatus, 'running' | 'skipped'>;
    finish: unknown;
  }): Promise<KnowledgeImporterRunRecord>;

  abstract getNode(bindingId: string, sourceId: string): Promise<KnowledgeImporterNodeRecord | null>;
  abstract getNodeByPage(pageId: string): Promise<KnowledgeImporterNodeRecord | null>;
  /** Insert or replace by `(bindingId, sourceId)`. A page already mapped to another node throws. */
  abstract saveNode(node: Omit<KnowledgeImporterNodeRecord, 'updatedAt'>): Promise<void>;
  abstract deleteNode(bindingId: string, sourceId: string): Promise<void>;
  /** Ordered by sourceId (byte order). `unsettled: true` lists only nodes with `unsettled` set. */
  abstract listNodes(
    bindingId: string,
    options?: { after?: string; limit?: number; unsettled?: boolean },
  ): Promise<KnowledgeImporterPage<KnowledgeImporterNodeRecord>>;
  abstract findNodeByAlias(bindingId: string, alias: string): Promise<KnowledgeImporterNodeRecord | null>;
  /**
   * The binding's nodes whose `links` name any of `targetSourceIds`, as source IDs, distinct, in byte
   * order. Other bindings' nodes never appear.
   */
  abstract listLinkingNodes(
    bindingId: string,
    targetSourceIds: string[],
    options?: { after?: string; limit?: number },
  ): Promise<KnowledgeImporterPage<string>>;
  /** Sets `unsettled` on every node {@link listLinkingNodes} would list, in one statement. */
  abstract markLinkingNodesUnsettled(bindingId: string, targetSourceIds: string[]): Promise<void>;

  abstract getState(bindingId: string): Promise<Record<string, string>>;
  /** Upserts the given keys; keys not given stay. */
  abstract setState(bindingId: string, state: Record<string, string>): Promise<void>;

  /** Insert or replace by `(runId, sourceId)`. */
  abstract recordRunChange(change: KnowledgeImporterRunChangeRecord): Promise<void>;
  /** In the order they were recorded. */
  abstract listRunChanges(
    runId: string,
    options?: { after?: string; limit?: number },
  ): Promise<KnowledgeImporterPage<KnowledgeImporterRunChangeRecord>>;

  /** The guard row, created at generation 1, path `'new'` on first read. */
  abstract readWriterGuard(): Promise<KnowledgeImporterWriterGuard>;
  /**
   * Inside a transaction: locks the guard row until commit, shared or exclusive, and returns it.
   * Choose the mode before locking; never upgrade a held lock.
   */
  abstract lockWriterGuard(mode: 'share' | 'update'): Promise<KnowledgeImporterWriterGuard>;
  /** Sets `firstWriteAt` if it is still null; returns whether this call set it. */
  abstract markFirstWrite(): Promise<boolean>;
  /**
   * Moves the writer to `activePath` at a strictly higher generation and clears `firstWriteAt`.
   * Call under `lockWriterGuard('update')` in the same transaction. Runs of older generations are
   * then refused at their next flush or finish.
   */
  abstract advanceWriterGuard(input: { activePath: string; generation: number }): Promise<KnowledgeImporterWriterGuard>;
}
