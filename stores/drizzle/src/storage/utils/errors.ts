export class DrizzleStoreError extends Error {
  constructor(
    message: string,
    public code: string,
    public dialect: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'DrizzleStoreError';

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DrizzleStoreError);
    }
  }
}

export enum ErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  DIALECT_NOT_SUPPORTED = 'DIALECT_NOT_SUPPORTED',
  DRIVER_NOT_FOUND = 'DRIVER_NOT_FOUND',
  DUPLICATE_KEY = 'DUPLICATE_KEY',
  FOREIGN_KEY_VIOLATION = 'FOREIGN_KEY_VIOLATION',
  NOT_NULL_VIOLATION = 'NOT_NULL_VIOLATION',
  QUERY_FAILED = 'QUERY_FAILED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Normalize database errors across different dialects
 */
export function normalizeError(error: unknown, dialect: string): DrizzleStoreError {
  const err = error as Error;
  const message = err?.message || 'Unknown database error';

  switch (dialect) {
    case 'postgresql':
    case 'neon':
    case 'vercel-postgres':
      return normalizePostgresError(error, dialect);

    case 'mysql':
    case 'planetscale':
    case 'tidb':
      return normalizeMysqlError(error, dialect);

    case 'sqlite':
    case 'turso':
    case 'cloudflare-d1':
      return normalizeSqliteError(error, dialect);

    default:
      return new DrizzleStoreError(message, ErrorCode.UNKNOWN, dialect, err);
  }
}

function normalizePostgresError(error: unknown, dialect: string): DrizzleStoreError {
  const err = error as any; // PostgreSQL error object
  const code = err?.code;
  const message = err?.message || 'PostgreSQL error';

  switch (code) {
    case '23505':
      return new DrizzleStoreError('Duplicate key violation', ErrorCode.DUPLICATE_KEY, dialect, err);
    case '23503':
      return new DrizzleStoreError('Foreign key violation', ErrorCode.FOREIGN_KEY_VIOLATION, dialect, err);
    case '23502':
      return new DrizzleStoreError('Not null violation', ErrorCode.NOT_NULL_VIOLATION, dialect, err);
    case '08001':
    case '08006':
      return new DrizzleStoreError('Connection failed', ErrorCode.CONNECTION_FAILED, dialect, err);
    default:
      return new DrizzleStoreError(message, ErrorCode.QUERY_FAILED, dialect, err);
  }
}

function normalizeMysqlError(error: unknown, dialect: string): DrizzleStoreError {
  const err = error as any; // MySQL error object
  const code = err?.code;
  const message = err?.message || 'MySQL error';

  switch (code) {
    case 'ER_DUP_ENTRY':
      return new DrizzleStoreError('Duplicate key violation', ErrorCode.DUPLICATE_KEY, dialect, err);
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      return new DrizzleStoreError('Foreign key violation', ErrorCode.FOREIGN_KEY_VIOLATION, dialect, err);
    case 'ER_BAD_NULL_ERROR':
      return new DrizzleStoreError('Not null violation', ErrorCode.NOT_NULL_VIOLATION, dialect, err);
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
      return new DrizzleStoreError('Connection failed', ErrorCode.CONNECTION_FAILED, dialect, err);
    default:
      return new DrizzleStoreError(message, ErrorCode.QUERY_FAILED, dialect, err);
  }
}

function normalizeSqliteError(error: unknown, dialect: string): DrizzleStoreError {
  const err = error as Error;
  const message = err?.message || 'SQLite error';

  if (message.includes('UNIQUE constraint failed')) {
    return new DrizzleStoreError('Duplicate key violation', ErrorCode.DUPLICATE_KEY, dialect, err);
  }

  if (message.includes('FOREIGN KEY constraint failed')) {
    return new DrizzleStoreError('Foreign key violation', ErrorCode.FOREIGN_KEY_VIOLATION, dialect, err);
  }

  if (message.includes('NOT NULL constraint failed')) {
    return new DrizzleStoreError('Not null violation', ErrorCode.NOT_NULL_VIOLATION, dialect, err);
  }

  return new DrizzleStoreError(message, ErrorCode.QUERY_FAILED, dialect, err);
}
