import type { z } from 'zod';

export type DomainErrorCode =
  | 'CONFLICT'
  | 'EVENT_OUT_OF_ORDER'
  | 'INVALID_TRANSITION'
  | 'NOT_FOUND'
  | 'PROVIDER_DELIVERY_FAILED'
  | 'PROVIDER_DELIVERY_PENDING'
  | 'PROVIDER_DELIVERY_UNCERTAIN'
  | 'STORAGE_UNAVAILABLE'
  | 'VALIDATION_FAILED';

const publicMessages: Record<DomainErrorCode, string> = {
  CONFLICT: 'The operation conflicts with the current state.',
  EVENT_OUT_OF_ORDER: 'The event is older than the current event stream.',
  INVALID_TRANSITION: 'The requested state transition is not allowed.',
  NOT_FOUND: 'The requested resource was not found.',
  PROVIDER_DELIVERY_FAILED:
    'External incident delivery stopped. Check the provider delivery record for the failure reason before recovery.',
  PROVIDER_DELIVERY_PENDING: 'External incident delivery is pending or awaiting a provider retry.',
  PROVIDER_DELIVERY_UNCERTAIN:
    'External incident delivery is uncertain. Reconciliation is required before another delivery attempt.',
  STORAGE_UNAVAILABLE: 'Storage is temporarily unavailable.',
  VALIDATION_FAILED: 'The request is invalid.',
};

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly retryable: boolean;

  constructor(code: DomainErrorCode, options: { retryable?: boolean } = {}) {
    super(publicMessages[code]);
    this.name = 'DomainError';
    this.code = code;
    this.retryable = options.retryable ?? false;
  }

  toPublic(): Readonly<{
    code: DomainErrorCode;
    message: string;
    retryable: boolean;
  }> {
    return Object.freeze({
      code: this.code,
      message: publicMessages[this.code],
      retryable: this.retryable,
    });
  }
}

export function toStorageError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  const codes = extractDriverCodes(error);
  if (codes.includes('SQLITE_CONSTRAINT_UNIQUE') || codes.includes('SQLITE_CONSTRAINT_PRIMARYKEY')) {
    return new DomainError('CONFLICT');
  }
  const retryable = codes.some(
    code =>
      code === 'SQLITE_BUSY' ||
      code.startsWith('SQLITE_BUSY_') ||
      code === 'SQLITE_LOCKED' ||
      code.startsWith('SQLITE_LOCKED_'),
  );
  return new DomainError('STORAGE_UNAVAILABLE', { retryable });
}

export function parseDomainSchema<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new DomainError('VALIDATION_FAILED');
  return result.data;
}

function extractDriverCodes(error: unknown): readonly string[] {
  if (typeof error !== 'object' || error === null) return [];
  const record = error as Record<string, unknown>;
  const codes: string[] = [];
  for (const key of ['code', 'extendedCode'] as const) {
    const value = record[key];
    if (typeof value === 'string') codes.push(value);
  }
  codes.push(...extractDriverCodes(record.cause));
  return codes;
}
