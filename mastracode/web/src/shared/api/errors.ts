interface ErrorRecord {
  body?: unknown;
  code?: unknown;
  message?: unknown;
  status?: unknown;
}

export interface AppErrorDetails {
  message: string;
  code?: string;
  status?: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function messageFromBody(body: unknown): string | undefined {
  if (typeof body === 'string' && body.trim()) return body.trim();
  const record = asRecord(body);
  if (!record) return undefined;
  if (typeof record.error === 'string' && record.error.trim()) return record.error.trim();
  if (typeof record.message === 'string' && record.message.trim()) return record.message.trim();
  const nestedError = asRecord(record.error);
  return typeof nestedError?.message === 'string' && nestedError.message.trim()
    ? nestedError.message.trim()
    : undefined;
}

export function getErrorDetails(error: unknown, fallback: string): AppErrorDetails {
  const record = asRecord(error) as ErrorRecord | null;
  const body = record?.body;
  const bodyRecord = asRecord(body);
  const message =
    messageFromBody(body) ??
    (typeof record?.message === 'string' && record.message.trim() ? record.message.trim() : fallback);
  const code =
    typeof bodyRecord?.code === 'string' ? bodyRecord.code : typeof record?.code === 'string' ? record.code : undefined;
  const status = typeof record?.status === 'number' ? record.status : undefined;

  return { message, ...(code ? { code } : {}), ...(status !== undefined ? { status } : {}) };
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return getErrorDetails(error, fallback).message;
}
