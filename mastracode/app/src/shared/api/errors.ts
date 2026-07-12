export interface AppErrorDetails {
  message: string;
  code?: string;
  status?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function messageFromBody(body: unknown): string | undefined {
  if (typeof body === 'string' && body.trim()) return body.trim();
  if (!isRecord(body)) return undefined;
  const record = body;
  if (typeof record.error === 'string' && record.error.trim()) return record.error.trim();
  if (typeof record.message === 'string' && record.message.trim()) return record.message.trim();
  const nestedError = isRecord(record.error) ? record.error : undefined;
  return typeof nestedError?.message === 'string' && nestedError.message.trim()
    ? nestedError.message.trim()
    : undefined;
}

export function getErrorDetails(error: unknown, fallback: string): AppErrorDetails {
  const record = isRecord(error) ? error : undefined;
  const body = record?.body;
  const bodyRecord = isRecord(body) ? body : undefined;
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
