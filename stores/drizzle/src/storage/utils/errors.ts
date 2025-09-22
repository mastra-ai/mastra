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
export function normalizeError(error: any, dialect: string): DrizzleStoreError {
  const message = error?.message || 'Unknown database error';

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
      return new DrizzleStoreError(message, ErrorCode.UNKNOWN, dialect, error);
  }
}

function normalizePostgresError(error: any, dialect: string): DrizzleStoreError {
  const code = error?.code;
  const message = error?.message || 'PostgreSQL error';

  switch (code) {
    case '23505':
      return new DrizzleStoreError('Duplicate key violation', ErrorCode.DUPLICATE_KEY, dialect, error);
    case '23503':
      return new DrizzleStoreError('Foreign key violation', ErrorCode.FOREIGN_KEY_VIOLATION, dialect, error);
    case '23502':
      return new DrizzleStoreError('Not null violation', ErrorCode.NOT_NULL_VIOLATION, dialect, error);
    case '08001':
    case '08006':
      return new DrizzleStoreError('Connection failed', ErrorCode.CONNECTION_FAILED, dialect, error);
    default:
      return new DrizzleStoreError(message, ErrorCode.QUERY_FAILED, dialect, error);
  }
}

function normalizeMysqlError(error: any, dialect: string): DrizzleStoreError {
  const code = error?.code;
  const message = error?.message || 'MySQL error';

  switch (code) {
    case 'ER_DUP_ENTRY':
      return new DrizzleStoreError('Duplicate key violation', ErrorCode.DUPLICATE_KEY, dialect, error);
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      return new DrizzleStoreError('Foreign key violation', ErrorCode.FOREIGN_KEY_VIOLATION, dialect, error);
    case 'ER_BAD_NULL_ERROR':
      return new DrizzleStoreError('Not null violation', ErrorCode.NOT_NULL_VIOLATION, dialect, error);
    case 'ECONNREFUSED':
    case 'ETIMEDOUT':
      return new DrizzleStoreError('Connection failed', ErrorCode.CONNECTION_FAILED, dialect, error);
    default:
      return new DrizzleStoreError(message, ErrorCode.QUERY_FAILED, dialect, error);
  }
}

function normalizeSqliteError(error: any, dialect: string): DrizzleStoreError {
  const message = error?.message || 'SQLite error';

  if (message.includes('UNIQUE constraint failed')) {
    return new DrizzleStoreError('Duplicate key violation', ErrorCode.DUPLICATE_KEY, dialect, error);
  }

  if (message.includes('FOREIGN KEY constraint failed')) {
    return new DrizzleStoreError('Foreign key violation', ErrorCode.FOREIGN_KEY_VIOLATION, dialect, error);
  }

  if (message.includes('NOT NULL constraint failed')) {
    return new DrizzleStoreError('Not null violation', ErrorCode.NOT_NULL_VIOLATION, dialect, error);
  }

  return new DrizzleStoreError(message, ErrorCode.QUERY_FAILED, dialect, error);
}
