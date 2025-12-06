/**
 * Retry utilities for Aurora DSQL (PostgreSQL + OCC).
 *
 * Aurora DSQL uses optimistic concurrency control (OCC) and may return
 * serialization errors (SQLSTATE 40001) that require retry. This module
 * provides utilities for handling such errors with exponential backoff
 * and full jitter.
 *
 * **Scope**: By default, this utility only retries OCC-related failures
 * identified by PostgreSQL SQLSTATE codes. Network-level or OS-level errors
 * are out of scope for the default implementation. Callers can provide a
 * custom `isRetriable` function to extend retriable conditions if needed.
 *
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */

/**
 * PostgreSQL SQLSTATE codes that may be retriable.
 *
 * By default, `isRetriableError` only retries `SERIALIZATION_FAILURE` (40001),
 * which is the primary OCC conflict error from Aurora DSQL.
 *
 * Other codes are provided for reference and can be used with a custom
 * `isRetriable` function if needed.
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const RETRIABLE_ERROR_CODES = {
  /** Serialization failure - OCC conflict in Aurora DSQL (default retriable) */
  SERIALIZATION_FAILURE: '40001',
  /** Deadlock detected (not retriable by default) */
  DEADLOCK_DETECTED: '40P01',
  /** Connection failure - may be transient (not retriable by default) */
  CONNECTION_FAILURE: '08006',
  /** Connection does not exist (not retriable by default) */
  CONNECTION_DOES_NOT_EXIST: '08003',
  /** Admin shutdown - server is restarting (not retriable by default) */
  ADMIN_SHUTDOWN: '57P01',
  /** Crash shutdown (not retriable by default) */
  CRASH_SHUTDOWN: '57P02',
  /** Cannot connect now (not retriable by default) */
  CANNOT_CONNECT_NOW: '57P03',
} as const;

/**
 * Default SQLSTATE codes that are retriable.
 * Only OCC serialization failure (40001) by default.
 */
const DEFAULT_RETRIABLE_SQLSTATES: ReadonlySet<string> = new Set([RETRIABLE_ERROR_CODES.SERIALIZATION_FAILURE]);

/**
 * Options for retry behavior.
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts (including the initial attempt).
   * Must be >= 1.
   * @default 5
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds before first retry.
   * Must be >= 0.
   * @default 100
   */
  initialDelayMs?: number;

  /**
   * Maximum delay in milliseconds between retries.
   * Must be > 0 and >= initialDelayMs.
   * @default 2000
   */
  maxDelayMs?: number;

  /**
   * Multiplier for exponential backoff.
   * Must be >= 1.
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Whether to add jitter to retry delays.
   * When true, uses "full jitter" algorithm: delay is uniformly random in [0, cappedDelay].
   * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
   * @default true
   */
  jitter?: boolean;

  /**
   * Optional callback invoked before each retry.
   * @param error - The error that triggered the retry
   * @param attempt - The attempt number that failed (1-based)
   * @param delayMs - The delay before the next attempt
   */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;

  /**
   * Custom function to determine if an error is retriable.
   * If not provided, uses the default `isRetriableError` function which only
   * retries on SQLSTATE 40001 (OCC serialization failure).
   */
  isRetriable?: (error: unknown) => boolean;
}

/**
 * Default retry options.
 *
 * Note: maxDelayMs is set to 2000ms as the standard for most operations.
 * For batch operations that may need more recovery time, override with 5000ms.
 */
export const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'isRetriable'>> = {
  maxAttempts: 5,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Interface for PostgreSQL errors (from pg library).
 */
export interface PostgresError extends Error {
  code?: string;
  severity?: string;
  detail?: string;
  hint?: string;
  position?: string;
  internalPosition?: string;
  internalQuery?: string;
  where?: string;
  schema?: string;
  table?: string;
  column?: string;
  dataType?: string;
  constraint?: string;
  file?: string;
  line?: string;
  routine?: string;
}

/**
 * Check if an error is a PostgreSQL error with a code.
 */
export function isPostgresError(error: unknown): error is PostgresError {
  return error instanceof Error && 'code' in error && typeof (error as PostgresError).code === 'string';
}

/**
 * Get the PostgreSQL error code from an error, if available.
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isPostgresError(error)) {
    return error.code;
  }
  return undefined;
}

/**
 * Pattern for valid PostgreSQL SQLSTATE codes: exactly 5 alphanumeric characters (uppercase).
 */
const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;

/**
 * Get the PostgreSQL SQLSTATE code from an error if valid.
 *
 * Returns the SQLSTATE code (normalized to uppercase) only if:
 * - The error is a PostgresError with a `code` property
 * - The code is exactly 5 characters of [0-9A-Za-z] (normalized to uppercase)
 *
 * @param error - The error to extract SQLSTATE from
 * @returns The SQLSTATE code (uppercase) if valid, undefined otherwise
 */
function getPostgresSqlStateCode(error: unknown): string | undefined {
  const raw = getErrorCode(error);
  if (!raw) return undefined;
  const code = raw.toUpperCase();
  if (SQLSTATE_PATTERN.test(code)) {
    return code;
  }
  return undefined;
}

/**
 * Check if an error is retriable based on its PostgreSQL SQLSTATE code.
 *
 * This function is designed for Aurora DSQL's OCC (Optimistic Concurrency Control).
 * By default, only SQLSTATE 40001 (serialization failure) is considered retriable.
 *
 * **Important**: This function does NOT retry on:
 * - Network errors (ECONNRESET, ECONNREFUSED, etc.)
 * - Timeout errors
 * - Other connection-level errors
 *
 * If you need to retry on additional error types, provide a custom `isRetriable`
 * function to `withRetry`.
 *
 * @param error - The error to check
 * @returns True if the error has a retriable SQLSTATE code (40001 by default)
 *
 * @example
 * ```typescript
 * // Create a PostgreSQL-like error
 * const createPgError = (code: string, message: string): PostgresError => {
 *   const err = new Error(message) as PostgresError;
 *   err.code = code;
 *   return err;
 * };
 *
 * // Default: only retries on 40001
 * isRetriableError(createPgError('40001', 'serialization failure')); // true
 * isRetriableError(createPgError('40P01', 'deadlock detected'));     // false
 * isRetriableError(new Error('connection timeout'));                 // false
 *
 * // Custom retriable check with additional codes:
 * const customIsRetriable = (error: unknown) => {
 *   const code = getErrorCode(error);
 *   return code === '40001' || code === '40P01';
 * };
 * ```
 */
export function isRetriableError(error: unknown): boolean {
  const sqlstate = getPostgresSqlStateCode(error);
  if (!sqlstate) {
    // No valid SQLSTATE: not retriable by default
    // (network errors, OS errors, etc. are out of scope)
    return false;
  }
  return DEFAULT_RETRIABLE_SQLSTATES.has(sqlstate);
}

/**
 * Calculate the delay for a retry attempt with exponential backoff and optional full jitter.
 *
 * Algorithm:
 * 1. baseDelay = initialDelayMs * backoffMultiplier^(attempt - 1)
 * 2. cappedDelay = min(baseDelay, maxDelayMs)
 * 3. If jitter is enabled (full jitter): return random integer in [0, cappedDelay]
 * 4. Otherwise: return cappedDelay
 *
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 *
 * @param attempt - The current attempt number (1-based)
 * @param options - Retry options
 * @returns Delay in milliseconds
 */
function calculateRetryDelay(
  attempt: number,
  options: Pick<RetryOptions, 'initialDelayMs' | 'maxDelayMs' | 'backoffMultiplier' | 'jitter'> = {},
): number {
  const {
    initialDelayMs = DEFAULT_RETRY_OPTIONS.initialDelayMs,
    maxDelayMs = DEFAULT_RETRY_OPTIONS.maxDelayMs,
    backoffMultiplier = DEFAULT_RETRY_OPTIONS.backoffMultiplier,
    jitter = DEFAULT_RETRY_OPTIONS.jitter,
  } = options;

  // Calculate base delay with exponential backoff
  const baseDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);

  // Apply max delay cap
  const cappedDelay = Math.min(baseDelay, maxDelayMs);

  // Full jitter: uniformly random delay in [0, cappedDelay]
  if (jitter) {
    return Math.floor(Math.random() * (cappedDelay + 1));
  }

  return cappedDelay;
}

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Resolved retry options with all numeric fields required.
 */
type ResolvedRetryOptions = {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
};

/**
 * Validate retry options at runtime.
 *
 * @param options - The resolved retry options to validate
 * @throws Error if any option is invalid
 */
function validateRetryOptions(options: ResolvedRetryOptions): void {
  const { maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier } = options;

  if (maxAttempts < 1) {
    throw new Error(`Invalid retry option: maxAttempts must be >= 1, got ${maxAttempts}`);
  }
  if (initialDelayMs < 0) {
    throw new Error(`Invalid retry option: initialDelayMs must be >= 0, got ${initialDelayMs}`);
  }
  if (maxDelayMs <= 0) {
    throw new Error(`Invalid retry option: maxDelayMs must be > 0, got ${maxDelayMs}`);
  }
  if (backoffMultiplier < 1) {
    throw new Error(`Invalid retry option: backoffMultiplier must be >= 1, got ${backoffMultiplier}`);
  }
  if (maxDelayMs < initialDelayMs) {
    throw new Error(`Invalid retry option: maxDelayMs (${maxDelayMs}) must be >= initialDelayMs (${initialDelayMs})`);
  }
}

/**
 * Result of a retry operation.
 */
export interface RetryResult<T> {
  /** The result if successful */
  result: T;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent (including delays) in milliseconds */
  totalTimeMs: number;
}

/**
 * Execute a function with automatic retry on retriable errors.
 *
 * Uses exponential backoff with optional full jitter to avoid thundering herd.
 * By default, only retries on PostgreSQL SQLSTATE 40001 (OCC serialization failure),
 * which is the primary conflict error from Aurora DSQL.
 *
 * @param fn - The async function to execute
 * @param options - Retry options
 * @returns The result of the function along with metadata
 * @throws The original error if all attempts fail or the error is not retriable
 * @throws Error if retry options are invalid
 *
 * @example
 * ```typescript
 * const { result, attempts, totalTimeMs } = await withRetry(
 *   async () => {
 *     return await db.query('INSERT INTO users ...');
 *   },
 *   {
 *     maxAttempts: 3,
 *     onRetry: (error, attempt, delay) => {
 *       console.log(`Retry ${attempt} after ${delay}ms: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<RetryResult<T>> {
  const {
    maxAttempts = DEFAULT_RETRY_OPTIONS.maxAttempts,
    initialDelayMs = DEFAULT_RETRY_OPTIONS.initialDelayMs,
    maxDelayMs = DEFAULT_RETRY_OPTIONS.maxDelayMs,
    backoffMultiplier = DEFAULT_RETRY_OPTIONS.backoffMultiplier,
    jitter = DEFAULT_RETRY_OPTIONS.jitter,
    onRetry,
    isRetriable = isRetriableError,
  } = options;

  // Validate resolved options
  validateRetryOptions({ maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier });

  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return {
        result,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this is the last attempt or the error is not retriable, throw
      if (attempt === maxAttempts || !isRetriable(error)) {
        throw lastError;
      }

      // Calculate delay and wait before retrying
      const delay = calculateRetryDelay(attempt, {
        initialDelayMs,
        maxDelayMs,
        backoffMultiplier,
        jitter,
      });

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt, delay);
      }

      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}
