import { ZodError } from 'zod';
import { WriterBusyError } from '../knowledge/writer-lock.ts';
import { ReviewConflict } from './contracts.ts';

const transientCodes = new Set([
  '40001', // PostgreSQL serialization failure
  '40P01', // deadlock detected
  '55P03', // lock not available
  '57P01', // administrator shutdown
  '57P03', // database cannot connect now
  'SQLITE_BUSY',
  'SQLITE_BUSY_RECOVERY',
  'SQLITE_BUSY_SNAPSHOT',
  'SQLITE_BUSY_TIMEOUT',
  'SQLITE_LOCKED',
  'SQLITE_LOCKED_SHAREDCACHE',
  'SQLITE_LOCKED_VTAB',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EPIPE',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
]);

/** Unknown faults fail closed; storage adapters may wrap a recognized transient cause. */
export function isRetryablePublicationError(error: unknown): boolean {
  const seen = new Set<object>();
  let transient = false;
  for (let depth = 0; error && typeof error === 'object' && depth < 10; depth++) {
    if (seen.has(error)) return false;
    seen.add(error);
    if (error instanceof ReviewConflict || error instanceof ZodError) return false;
    const { code, errcode, cause } = error as { code?: unknown; errcode?: unknown; cause?: unknown };
    if (
      error instanceof WriterBusyError ||
      (typeof code === 'string' && transientCodes.has(code)) ||
      (typeof errcode === 'number' && Number.isInteger(errcode) && [5, 6].includes(errcode & 0xff))
    )
      transient = true;
    error = cause;
  }
  return transient;
}
