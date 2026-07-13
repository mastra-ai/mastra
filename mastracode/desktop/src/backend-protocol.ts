export type DesktopBackendRequest =
  | { type: 'start'; requestId: string; projectAccessFile: string }
  | { type: 'approve-project'; requestId: string; path: string }
  | { type: 'close'; requestId: string };

export type DesktopBackendResponse =
  | {
      type: 'started';
      requestId: string;
      bootstrapUrl: string;
      origin: string;
      port: number;
    }
  | { type: 'approved-project'; requestId: string; path: string }
  | { type: 'closed'; requestId: string }
  | { type: 'error'; requestId: string; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasRequestEnvelope(value: Record<string, unknown>): value is Record<string, unknown> & { requestId: string } {
  return typeof value.requestId === 'string' && value.requestId.length > 0;
}

export function parseDesktopBackendRequest(value: unknown): DesktopBackendRequest {
  if (!isRecord(value) || !hasRequestEnvelope(value)) {
    throw new TypeError('Desktop backend request envelope is invalid');
  }

  if (value.type === 'start' && typeof value.projectAccessFile === 'string' && value.projectAccessFile.length > 0) {
    return { type: 'start', requestId: value.requestId, projectAccessFile: value.projectAccessFile };
  }
  if (value.type === 'approve-project' && typeof value.path === 'string' && value.path.length > 0) {
    return { type: 'approve-project', requestId: value.requestId, path: value.path };
  }
  if (value.type === 'close') {
    return { type: 'close', requestId: value.requestId };
  }
  throw new TypeError('Desktop backend request is invalid');
}

export function parseDesktopBackendResponse(value: unknown): DesktopBackendResponse {
  if (!isRecord(value) || !hasRequestEnvelope(value)) {
    throw new TypeError('Desktop backend response envelope is invalid');
  }

  if (
    value.type === 'started' &&
    typeof value.bootstrapUrl === 'string' &&
    typeof value.origin === 'string' &&
    typeof value.port === 'number' &&
    Number.isInteger(value.port) &&
    value.port > 0 &&
    value.port <= 65_535
  ) {
    return {
      type: 'started',
      requestId: value.requestId,
      bootstrapUrl: value.bootstrapUrl,
      origin: value.origin,
      port: value.port,
    };
  }
  if (value.type === 'approved-project' && typeof value.path === 'string' && value.path.length > 0) {
    return { type: 'approved-project', requestId: value.requestId, path: value.path };
  }
  if (value.type === 'closed') {
    return { type: 'closed', requestId: value.requestId };
  }
  if (value.type === 'error' && typeof value.message === 'string' && value.message.length > 0) {
    return { type: 'error', requestId: value.requestId, message: value.message };
  }
  throw new TypeError('Desktop backend response is invalid');
}
