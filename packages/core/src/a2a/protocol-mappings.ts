/**
 * Shared A2A 0.3 ↔ 1.0 shape mappings.
 * Server encode and client/core decode both use these so tables cannot drift.
 */

export const V0_3_TO_V1_TASK_STATE = {
  submitted: 'TASK_STATE_SUBMITTED',
  working: 'TASK_STATE_WORKING',
  completed: 'TASK_STATE_COMPLETED',
  failed: 'TASK_STATE_FAILED',
  canceled: 'TASK_STATE_CANCELED',
  'input-required': 'TASK_STATE_INPUT_REQUIRED',
  rejected: 'TASK_STATE_REJECTED',
  'auth-required': 'TASK_STATE_AUTH_REQUIRED',
} as const;

export const V1_TO_V0_3_TASK_STATE = {
  TASK_STATE_SUBMITTED: 'submitted',
  TASK_STATE_WORKING: 'working',
  TASK_STATE_COMPLETED: 'completed',
  TASK_STATE_FAILED: 'failed',
  TASK_STATE_CANCELED: 'canceled',
  TASK_STATE_INPUT_REQUIRED: 'input-required',
  TASK_STATE_REJECTED: 'rejected',
  TASK_STATE_AUTH_REQUIRED: 'auth-required',
} as const;

export type V0_3TaskState = keyof typeof V0_3_TO_V1_TASK_STATE;
export type V1TaskState = (typeof V0_3_TO_V1_TASK_STATE)[V0_3TaskState];

export function mapV0_3TaskStateToV1(state: unknown): V1TaskState {
  if (typeof state === 'string' && state in V0_3_TO_V1_TASK_STATE) {
    return V0_3_TO_V1_TASK_STATE[state as V0_3TaskState];
  }
  throw new Error(`Unsupported A2A task state for v1 encoding: ${String(state)}`);
}

export function mapV1TaskStateToV0_3(state: unknown): V0_3TaskState | 'unknown' {
  if (typeof state === 'string' && state in V1_TO_V0_3_TASK_STATE) {
    return V1_TO_V0_3_TASK_STATE[state as keyof typeof V1_TO_V0_3_TASK_STATE];
  }
  return 'unknown';
}

/**
 * Slice task history for wire responses.
 * - `undefined` → full history
 * - `0` → empty
 * - `n > 0` → last n messages
 */
export function sliceTaskHistory<T>(history: T[] | undefined, historyLength?: number): T[] | undefined {
  if (!history) {
    return undefined;
  }
  if (historyLength === undefined) {
    return history;
  }
  if (historyLength === 0) {
    return [];
  }
  return history.slice(-historyLength);
}

export function normalizeV1Part(part: Record<string, unknown>) {
  if ('text' in part) {
    return { kind: 'text' as const, text: part.text, metadata: part.metadata };
  }
  if ('raw' in part) {
    return {
      kind: 'file' as const,
      file: { bytes: part.raw, mimeType: part.mediaType, name: part.filename },
      metadata: part.metadata,
    };
  }
  if ('url' in part) {
    return {
      kind: 'file' as const,
      file: { uri: part.url, mimeType: part.mediaType, name: part.filename },
      metadata: part.metadata,
    };
  }
  return { kind: 'data' as const, data: part.data, metadata: part.metadata };
}

export function toV1Part(part: any) {
  if (part.kind === 'text') {
    return { text: part.text, metadata: part.metadata };
  }
  if (part.kind === 'file') {
    return 'uri' in part.file
      ? { url: part.file.uri, filename: part.file.name, mediaType: part.file.mimeType, metadata: part.metadata }
      : { raw: part.file.bytes, filename: part.file.name, mediaType: part.file.mimeType, metadata: part.metadata };
  }
  return { data: part.data, metadata: part.metadata };
}

export function normalizeV1Message(message: Record<string, any>) {
  return {
    kind: 'message' as const,
    messageId: message.messageId,
    contextId: message.contextId,
    taskId: message.taskId,
    role: message.role === 'ROLE_AGENT' ? ('agent' as const) : ('user' as const),
    parts: (message.parts ?? []).map((part: Record<string, unknown>) => normalizeV1Part(part)),
    metadata: message.metadata,
    extensions: message.extensions,
    referenceTaskIds: message.referenceTaskIds,
  };
}

export function toV1Message(message: any) {
  if (!message) return undefined;
  return {
    messageId: message.messageId,
    contextId: message.contextId,
    taskId: message.taskId,
    role: message.role === 'agent' ? 'ROLE_AGENT' : 'ROLE_USER',
    parts: message.parts?.map(toV1Part),
    metadata: message.metadata,
    extensions: message.extensions,
    referenceTaskIds: message.referenceTaskIds,
  };
}
