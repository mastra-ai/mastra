/**
 * Batch utilities for Aurora DSQL.
 *
 * Aurora DSQL has transaction limits:
 * - Maximum 3,000 rows per transaction
 * - Maximum 10 MiB per transaction
 *
 * This utility only enforces the row-count limit.
 * The 10 MiB limit depends on the size of each record, so please enforce it
 * in the caller if needed.
 */

/**
 * Default maximum rows per batch.
 * Aurora DSQL limits transactions to 3,000 rows.
 */
export const DEFAULT_MAX_ROWS_PER_BATCH = 3000;

/**
 * Options for batch splitting.
 */
export interface BatchOptions {
  /**
   * Maximum number of rows per batch.
   * @default 3000 (Aurora DSQL limit)
   */
  maxRows?: number;
}

/**
 * Result of batch splitting.
 */
export interface BatchResult<T> {
  /** The batched records */
  batches: T[][];
  /** Total number of records */
  totalRecords: number;
  /** Number of batches created */
  batchCount: number;
}

/**
 * Split an array of records into batches that respect Aurora DSQL's transaction limits.
 *
 * @param records - Array of records to split
 * @param options - Batch splitting options
 * @returns BatchResult containing the batched records and metadata
 *
 * @example
 * ```typescript
 * const records = generateRecords(5000);
 * const result = splitIntoBatches(records);
 * // result.batches.length === 2
 * // result.batches[0].length === 3000
 * // result.batches[1].length === 2000
 * ```
 */
export function splitIntoBatches<T>(records: T[], options: BatchOptions = {}): BatchResult<T> {
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS_PER_BATCH;

  if (records.length === 0) {
    return {
      batches: [],
      totalRecords: 0,
      batchCount: 0,
    };
  }

  if (maxRows <= 0) {
    throw new Error(`maxRows must be a positive number, got: ${maxRows}`);
  }

  const batches: T[][] = [];
  for (let i = 0; i < records.length; i += maxRows) {
    batches.push(records.slice(i, i + maxRows));
  }

  return {
    batches,
    totalRecords: records.length,
    batchCount: batches.length,
  };
}
