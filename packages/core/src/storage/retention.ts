import type { StorageDomains } from './base';

/**
 * A human-friendly duration for retention policies.
 *
 * Either a raw number of **milliseconds**, or a string with a unit suffix:
 * - `ms` milliseconds
 * - `s`  seconds
 * - `m`  minutes
 * - `h`  hours
 * - `d`  days
 * - `w`  weeks
 *
 * @example
 * '30d'   // 30 days
 * '12h'   // 12 hours
 * 604800000 // 7 days in ms
 */
export type Duration = number | `${number}${'ms' | 's' | 'm' | 'h' | 'd' | 'w'}`;

/**
 * Age-based retention policy for a single table.
 *
 * Rows whose anchor timestamp column is strictly older than `maxAge`
 * (i.e. `anchor < Date.now() - maxAge`) are eligible for deletion.
 */
export interface TableRetentionPolicy {
  /**
   * Maximum age to keep rows for. Rows older than this are pruned.
   */
  maxAge: Duration;

  /**
   * Rows deleted per batch (each batch is its own transaction).
   * Bounds lock duration and WAL growth on large tables.
   *
   * @default 1000
   */
  batchSize?: number;
}

/**
 * Options controlling a single `prune()` invocation.
 *
 * These bound the work performed so a prune can never run unbounded, and let
 * the caller cooperatively cancel and pace deletions against live traffic.
 *
 * `prune()` only deletes rows — it never reclaims disk. On SQLite/LibSQL freed
 * pages are reused by future writes so the file stops growing. Handing disk
 * back to the OS (e.g. `VACUUM`) is left to the underlying database and the
 * operator to manage.
 */
export interface PruneOptions {
  /**
   * Maximum number of delete batches per table per call.
   * When reached, the table's result is returned with `done: false`.
   */
  maxBatches?: number;

  /**
   * Maximum number of rows deleted per table per call.
   * When reached, the table's result is returned with `done: false`.
   */
  maxRows?: number;

  /**
   * Delay in milliseconds between batches, to avoid starving live traffic.
   */
  pauseMs?: number;

  /**
   * Cooperative cancellation. The batch loop checks this between batches and
   * stops cleanly, returning partial results with `done: false`.
   */
  signal?: AbortSignal;
}

/**
 * Result of pruning a single table.
 */
export interface PruneResult {
  /** Domain key the pruned table belongs to (e.g. `memory`). */
  domain: string;

  /** Physical table name that was pruned (e.g. `mastra_messages`). */
  table: string;

  /** Number of rows deleted during this call. */
  deleted: number;

  /**
   * `false` means eligible rows remain (a cap or the abort signal stopped the
   * loop early). Call `prune()` again to continue.
   */
  done: boolean;
}

/**
 * Per-domain map of the stable retention table keys each domain exposes.
 *
 * This is the source of truth for which table keys are valid under each
 * domain in `RetentionConfig`. It intentionally mirrors each domain's
 * `retentionTables` descriptor and is validated against it at runtime by the
 * reference implementations.
 *
 * Domains not listed here fall back to `never`, so no table policies can be
 * set on them until they declare their retention tables.
 */
export interface DomainRetentionTables {
  memory: 'threads' | 'messages' | 'resources';
  observability: 'spans';
}

/**
 * The valid retention table keys for a given storage domain `D`.
 *
 * Resolves to the domain's declared table-key union when known, otherwise
 * `never` (no table policies allowed).
 */
export type RetentionTableKey<D extends keyof StorageDomains> = D extends keyof DomainRetentionTables
  ? DomainRetentionTables[D]
  : never;

/**
 * Fully-typed retention configuration.
 *
 * Keys are real domain keys from `StorageDomains`; values map real per-table
 * keys (from that domain's `retentionTables`) to their policies. Unknown
 * domains or unknown table keys are compile errors.
 *
 * Anything left unset is kept forever.
 *
 * @example
 * ```typescript
 * const retention: RetentionConfig = {
 *   memory: {
 *     messages: { maxAge: '30d' },
 *     threads: { maxAge: '90d', batchSize: 500 },
 *   },
 *   observability: {
 *     spans: { maxAge: '7d' },
 *   },
 * };
 * ```
 */
export type RetentionConfig = {
  [D in keyof StorageDomains]?: Partial<Record<RetentionTableKey<D>, TableRetentionPolicy>>;
};

/**
 * Descriptor entry for a single retention-eligible table.
 *
 * Each domain exposes a `retentionTables` record mapping a stable table key
 * to this descriptor. It is the single source of truth for the physical table
 * name, the timestamp anchor column, and whether that column is indexed
 * (batched timestamp deletes are only fast with an index on the anchor).
 */
export interface RetentionTableDescriptor {
  /** Physical table name (e.g. `mastra_messages`). */
  table: string;

  /** Timestamp anchor column used for the age comparison (e.g. `createdAt`). */
  column: string;

  /** Whether `column` is indexed. Unindexed anchors make batched deletes slow. */
  indexed: boolean;
}

/**
 * A domain's `retentionTables` descriptor: stable table key → descriptor.
 */
export type RetentionTablesDescriptor = Record<string, RetentionTableDescriptor>;
