/**
 * Turso error normalization.
 *
 * The Turso engine reports every failure as a single opaque `GenericFailure`
 * code on a plain `Error`/`SqliteError` — there is no `extendedCode` and
 * `rustCode` is undefined. Verified against `@tursodatabase/database@0.7.2`:
 *
 * ```
 * PK dup       code=GenericFailure  "step failed: Runtime error: UNIQUE constraint failed: p.id (19)"
 * UNIQUE dup   code=GenericFailure  "step failed: Runtime error: UNIQUE constraint failed: u.e (19)"
 * NOT NULL     code=GenericFailure  "step failed: Runtime error: NOT NULL constraint failed: p.v (19)"
 * CHECK        code=GenericFailure  "step failed: Runtime error: CHECK constraint failed: n > 0 (19)"
 * FK           code=GenericFailure  "step failed: Runtime error: FOREIGN KEY constraint failed"
 * busy         code=GenericFailure  "database is locked"
 * nested BEGIN code=GenericFailure  "step failed: Transaction error: cannot start a transaction within a transaction"
 * no such tbl  code=GenericFailure  "prepare failed: Parse error: no such table: nope"
 * ```
 *
 * Storage domains branch on SQLite codes to distinguish a recoverable
 * insert-race (`SQLITE_CONSTRAINT_UNIQUE`) from a genuine bug (`NOT NULL`,
 * `CHECK`, `FOREIGN KEY`) and to decide what is worth retrying
 * (`SQLITE_BUSY`). Matching on raw message substrings at each call site would
 * spread that parsing across the codebase and silently conflate those cases,
 * so classification happens once, here, and every error leaving the driver
 * carries a real code.
 */

/** SQLite result/extended codes this driver reconstructs from Turso messages. */
export type TursoErrorCode =
  | 'SQLITE_BUSY'
  | 'SQLITE_CONSTRAINT'
  | 'SQLITE_CONSTRAINT_PRIMARYKEY'
  | 'SQLITE_CONSTRAINT_UNIQUE'
  | 'SQLITE_CONSTRAINT_NOTNULL'
  | 'SQLITE_CONSTRAINT_CHECK'
  | 'SQLITE_CONSTRAINT_FOREIGNKEY'
  | 'SQLITE_ERROR'
  | 'SQLITE_MISMATCH'
  | 'SQLITE_MISUSE'
  | 'SQLITE_UNKNOWN';

/**
 * Error thrown by the Turso storage driver.
 *
 * Mirrors the `code`/`extendedCode` shape that SQLite-backed Mastra stores
 * branch on, so domain logic reads a code instead of re-parsing prose.
 */
export class TursoError extends Error {
  /** Primary SQLite result code (e.g. `SQLITE_CONSTRAINT`). */
  readonly code: TursoErrorCode;
  /** Extended SQLite result code (e.g. `SQLITE_CONSTRAINT_UNIQUE`), when known. */
  readonly extendedCode?: string;

  constructor(message: string, code: TursoErrorCode, extendedCode?: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'TursoError';
    this.code = code;
    if (extendedCode !== undefined) this.extendedCode = extendedCode;
  }
}

/**
 * `[primary code, extended code]` for a Turso message. Ordered most specific
 * first: every constraint message also contains "constraint failed", so the
 * specific constraint kinds must be tested before any generic fallback.
 */
const MESSAGE_PATTERNS: ReadonlyArray<readonly [RegExp, TursoErrorCode, string | undefined]> = [
  // A PK conflict is reported as a UNIQUE violation against the `rowid` alias
  // or the declared PK column; SQLite distinguishes the two extended codes but
  // Turso does not, so both map to UNIQUE and callers treat them alike.
  [/UNIQUE constraint failed/i, 'SQLITE_CONSTRAINT', 'SQLITE_CONSTRAINT_UNIQUE'],
  [/NOT NULL constraint failed/i, 'SQLITE_CONSTRAINT', 'SQLITE_CONSTRAINT_NOTNULL'],
  [/CHECK constraint failed/i, 'SQLITE_CONSTRAINT', 'SQLITE_CONSTRAINT_CHECK'],
  [/FOREIGN KEY constraint failed/i, 'SQLITE_CONSTRAINT', 'SQLITE_CONSTRAINT_FOREIGNKEY'],
  [/constraint failed/i, 'SQLITE_CONSTRAINT', undefined],
  // Lock contention. Turso surfaces the bare SQLite phrasing with no code.
  [/database (?:table )?is locked/i, 'SQLITE_BUSY', undefined],
  [/database is busy/i, 'SQLITE_BUSY', undefined],
  // Transaction misuse: nesting a BEGIN, or committing with none open. These
  // signal a driver/caller bug rather than a transient fault, so they must not
  // be classified as retryable.
  [/cannot start a transaction within a transaction/i, 'SQLITE_MISUSE', undefined],
  [/cannot (?:commit|rollback) - no transaction is active/i, 'SQLITE_MISUSE', undefined],
  // Schema and statement errors.
  [/no such (?:table|column|index|trigger|view)/i, 'SQLITE_ERROR', undefined],
  [/syntax error/i, 'SQLITE_ERROR', undefined],
  [/Parse error/i, 'SQLITE_ERROR', undefined],
];

/** Extracts a message from an arbitrary thrown value. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error !== null && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * Classifies a raw Turso message into SQLite codes.
 *
 * Exported for direct testing against driver output, so the mapping stays
 * pinned to what the engine actually emits.
 */
export function classifyTursoMessage(message: string): [TursoErrorCode, string | undefined] {
  for (const [pattern, code, extendedCode] of MESSAGE_PATTERNS) {
    if (pattern.test(message)) return [code, extendedCode];
  }
  return ['SQLITE_UNKNOWN', undefined];
}

/**
 * Wraps an error thrown by the Turso driver in a {@link TursoError} carrying
 * reconstructed SQLite codes, preserving the original as `cause`.
 *
 * Already-normalized errors pass through unchanged so the classification is
 * not reapplied as an error crosses nested driver frames.
 */
export function normalizeTursoError(error: unknown, context?: string): TursoError {
  if (error instanceof TursoError) return error;

  const message = messageOf(error);
  const [code, extendedCode] = classifyTursoMessage(message);
  return new TursoError(context ? `${context}: ${message}` : message, code, extendedCode, { cause: error });
}

/** SQLite codes worth retrying: the write blocked on a lock rather than failed. */
const RETRYABLE_CODES: ReadonlySet<TursoErrorCode> = new Set(['SQLITE_BUSY']);

/**
 * Whether an error represents transient lock contention and the operation can
 * be retried after a backoff.
 */
export function isRetryableTursoError(error: unknown): boolean {
  const code = error instanceof TursoError ? error.code : classifyTursoMessage(messageOf(error))[0];
  return RETRYABLE_CODES.has(code);
}

/**
 * Whether an error is a uniqueness conflict (including primary-key conflicts).
 *
 * Distinguishes a losing insert race, which callers recover from by reading the
 * winning row, from `NOT NULL`/`CHECK`/`FOREIGN KEY` violations, which are real
 * defects and must surface.
 */
export function isUniqueViolation(error: unknown): boolean {
  const extendedCode =
    error instanceof TursoError ? error.extendedCode : classifyTursoMessage(messageOf(error))[1];
  return extendedCode === 'SQLITE_CONSTRAINT_UNIQUE';
}
