import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId } from '@mastra/core/storage';

import { parseOracleJson } from './db';

export type OracleStorageErrorDetails = Record<string, string | number | boolean | undefined>;

export function createOracleStorageError({
  storeName = 'ORACLEDB',
  operation,
  reason,
  details,
  cause,
  category = ErrorCategory.THIRD_PARTY,
}: {
  storeName?: string;
  operation: string;
  reason: string;
  details: OracleStorageErrorDetails;
  cause: unknown;
  category?: ErrorCategory;
}): MastraError {
  const safeDetails = Object.fromEntries(
    Object.entries(details).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined),
  );

  return new MastraError(
    {
      id: createStorageErrorId(storeName, operation, reason),
      domain: ErrorDomain.STORAGE,
      category,
      details: safeDetails,
    },
    cause,
  );
}

export function parseJsonValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' && !Buffer.isBuffer(value)) return value;

  const raw = Buffer.isBuffer(value) ? value.toString('utf8') : value;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function parseOptionalJson<T>(value: unknown): T | undefined {
  return parseOracleJson<T>(value);
}

export function parseOptionalJsonObject(
  value: unknown,
  options: { emptyObjectAsUndefined?: boolean } = {},
): Record<string, unknown> | undefined {
  const parsed = parseJsonValue(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  if (options.emptyObjectAsUndefined && Object.keys(parsed).length === 0) return undefined;
  return parsed as Record<string, unknown>;
}

export function parseOptionalStringArray(value: unknown): string[] | undefined {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) return undefined;
  return parsed.map(item => String(item));
}

export function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}
