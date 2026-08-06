/**
 * Version-boundary translation between the legacy A2A v0.3 wire format and the
 * v1 wire format that Mastra uses internally. The A2A SDK's `compat/v0_3` layer
 * provides the method-name and card-interface translators; the message/part/
 * task translators below are Mastra's, since Mastra works with wire-JSON
 * directly rather than the SDK's in-memory types.
 *
 * See {@link ./wire-types.ts} for the v1 wire shapes.
 */
import { a2aV03Compat } from '@mastra/core/a2a';
import type {
  A2ARoleWire,
  A2ATaskStateWire,
  A2AWireArtifact,
  A2AWireMessage,
  A2AWirePart,
  A2AWireStreamEvent,
  A2AWireTask,
  A2AWireTaskArtifactUpdateEvent,
  A2AWireTaskStatus,
  A2AWireTaskStatusUpdateEvent,
} from './wire-types';
import { isWireArtifactUpdate, isWireMessage, isWireStatusUpdate, isWireTask } from './wire-types';

// ---------------------------------------------------------------------------
// Method-name normalization (v0.3 slash-names <-> v1 PascalCase)
// ---------------------------------------------------------------------------

/**
 * Normalizes an incoming JSON-RPC method name to its v1 PascalCase form.
 * Accepts both v0.3 slash-names (`message/send`) and v1 names (`SendMessage`).
 * Returns `undefined` for unrecognized methods so the caller can raise
 * `methodNotFound` with the original name.
 */
export function normalizeToV1Method(method: string): string | undefined {
  if (a2aV03Compat.isV1JsonRpcMethod(method)) {
    return method;
  }
  if (a2aV03Compat.isLegacyJsonRpcMethod(method)) {
    return a2aV03Compat.legacyJsonRpcToV1Method(method);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// TaskState mapping
// ---------------------------------------------------------------------------

type V03TaskState =
  | 'submitted'
  | 'working'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'input-required'
  | 'rejected'
  | 'auth-required'
  | 'unknown';

const V1_TO_V03_STATE: Record<A2ATaskStateWire, V03TaskState> = {
  TASK_STATE_SUBMITTED: 'submitted',
  TASK_STATE_WORKING: 'working',
  TASK_STATE_COMPLETED: 'completed',
  TASK_STATE_FAILED: 'failed',
  TASK_STATE_CANCELED: 'canceled',
  TASK_STATE_INPUT_REQUIRED: 'input-required',
  TASK_STATE_REJECTED: 'rejected',
  TASK_STATE_AUTH_REQUIRED: 'auth-required',
  TASK_STATE_UNSPECIFIED: 'unknown',
};

const V03_TO_V1_STATE: Record<V03TaskState, A2ATaskStateWire> = {
  submitted: 'TASK_STATE_SUBMITTED',
  working: 'TASK_STATE_WORKING',
  completed: 'TASK_STATE_COMPLETED',
  failed: 'TASK_STATE_FAILED',
  canceled: 'TASK_STATE_CANCELED',
  'input-required': 'TASK_STATE_INPUT_REQUIRED',
  rejected: 'TASK_STATE_REJECTED',
  'auth-required': 'TASK_STATE_AUTH_REQUIRED',
  unknown: 'TASK_STATE_UNSPECIFIED',
};

const V1_TO_V03_ROLE: Record<A2ARoleWire, 'user' | 'agent'> = {
  ROLE_USER: 'user',
  ROLE_AGENT: 'agent',
  ROLE_UNSPECIFIED: 'user',
};

// ---------------------------------------------------------------------------
// v0.3 wire shapes (only the fields Mastra reads/writes)
// ---------------------------------------------------------------------------

type V03Part =
  | { kind: 'text'; text: string; metadata?: Record<string, unknown> }
  | {
      kind: 'file';
      file: { bytes?: string; uri?: string; mimeType?: string; name?: string };
      metadata?: Record<string, unknown>;
    }
  | { kind: 'data'; data: Record<string, unknown>; metadata?: Record<string, unknown> };

interface V03Message {
  kind: 'message';
  messageId: string;
  role: 'user' | 'agent';
  parts: V03Part[];
  contextId?: string;
  taskId?: string;
  referenceTaskIds?: string[];
  extensions?: string[];
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Part translation
// ---------------------------------------------------------------------------

/** v0.3 wire part -> v1 wire part. */
export function v03PartToV1(part: V03Part): A2AWirePart {
  switch (part.kind) {
    case 'text':
      return { text: part.text, ...(part.metadata ? { metadata: part.metadata } : {}) };
    case 'data':
      return { data: part.data, ...(part.metadata ? { metadata: part.metadata } : {}) };
    case 'file': {
      const { bytes, uri, mimeType, name } = part.file;
      const common = {
        ...(mimeType ? { mediaType: mimeType } : {}),
        ...(name ? { filename: name } : {}),
        ...(part.metadata ? { metadata: part.metadata } : {}),
      };
      return uri !== undefined ? { url: uri, ...common } : { raw: bytes ?? '', ...common };
    }
  }
}

/** v1 wire part -> v0.3 wire part. */
export function v1PartToV03(part: A2AWirePart): V03Part {
  if ('text' in part) {
    return { kind: 'text', text: part.text, ...(part.metadata ? { metadata: part.metadata } : {}) };
  }
  if ('data' in part) {
    return {
      kind: 'data',
      data: part.data as Record<string, unknown>,
      ...(part.metadata ? { metadata: part.metadata } : {}),
    };
  }
  const file: { bytes?: string; uri?: string; mimeType?: string; name?: string } = {};
  if ('url' in part) file.uri = part.url;
  if ('raw' in part) file.bytes = part.raw;
  if (part.mediaType) file.mimeType = part.mediaType;
  if ('filename' in part && part.filename) file.name = part.filename;
  return { kind: 'file', file, ...(part.metadata ? { metadata: part.metadata } : {}) };
}

// ---------------------------------------------------------------------------
// Message translation
// ---------------------------------------------------------------------------

/** v0.3 wire message -> v1 wire message. */
export function v03MessageToV1(message: V03Message): A2AWireMessage {
  return {
    messageId: message.messageId,
    role: message.role === 'agent' ? 'ROLE_AGENT' : 'ROLE_USER',
    parts: message.parts.map(v03PartToV1),
    ...(message.contextId ? { contextId: message.contextId } : {}),
    ...(message.taskId ? { taskId: message.taskId } : {}),
    ...(message.referenceTaskIds ? { referenceTaskIds: message.referenceTaskIds } : {}),
    ...(message.extensions ? { extensions: message.extensions } : {}),
    ...(message.metadata ? { metadata: message.metadata } : {}),
  };
}

/** v1 wire message -> v0.3 wire message. */
export function v1MessageToV03(message: A2AWireMessage): V03Message {
  return {
    kind: 'message',
    messageId: message.messageId,
    role: V1_TO_V03_ROLE[message.role] ?? 'user',
    parts: message.parts.map(v1PartToV03),
    ...(message.contextId ? { contextId: message.contextId } : {}),
    ...(message.taskId ? { taskId: message.taskId } : {}),
    ...(message.referenceTaskIds ? { referenceTaskIds: message.referenceTaskIds } : {}),
    ...(message.extensions ? { extensions: message.extensions } : {}),
    ...(message.metadata ? { metadata: message.metadata } : {}),
  };
}

// ---------------------------------------------------------------------------
// Status / Artifact / Task / event translation (v1 -> v0.3, for outbound)
// ---------------------------------------------------------------------------

function v1StatusToV03(status: A2AWireTaskStatus): Record<string, unknown> {
  return {
    state: V1_TO_V03_STATE[status.state] ?? 'unknown',
    ...(status.message ? { message: v1MessageToV03(status.message) } : {}),
    ...(status.timestamp ? { timestamp: status.timestamp } : {}),
  };
}

function v1ArtifactToV03(artifact: A2AWireArtifact): Record<string, unknown> {
  return {
    artifactId: artifact.artifactId,
    ...(artifact.name ? { name: artifact.name } : {}),
    ...(artifact.description ? { description: artifact.description } : {}),
    parts: artifact.parts.map(v1PartToV03),
    ...(artifact.metadata ? { metadata: artifact.metadata } : {}),
    ...(artifact.extensions ? { extensions: artifact.extensions } : {}),
  };
}

/** v1 wire Task -> v0.3 wire Task (adds back `kind` discriminators). */
export function v1TaskToV03(task: A2AWireTask): Record<string, unknown> {
  return {
    kind: 'task',
    id: task.id,
    contextId: task.contextId,
    status: v1StatusToV03(task.status),
    ...(task.artifacts ? { artifacts: task.artifacts.map(v1ArtifactToV03) } : {}),
    ...(task.history ? { history: task.history.map(v1MessageToV03) } : {}),
    ...(task.metadata ? { metadata: task.metadata } : {}),
  };
}

function v1StatusUpdateToV03(event: A2AWireTaskStatusUpdateEvent): Record<string, unknown> {
  return {
    kind: 'status-update',
    taskId: event.taskId,
    contextId: event.contextId,
    status: v1StatusToV03(event.status),
    ...(event.metadata ? { metadata: event.metadata } : {}),
  };
}

function v1ArtifactUpdateToV03(event: A2AWireTaskArtifactUpdateEvent): Record<string, unknown> {
  return {
    kind: 'artifact-update',
    taskId: event.taskId,
    contextId: event.contextId,
    artifact: v1ArtifactToV03(event.artifact),
    ...(event.append !== undefined ? { append: event.append } : {}),
    ...(event.lastChunk !== undefined ? { lastChunk: event.lastChunk } : {}),
    ...(event.metadata ? { metadata: event.metadata } : {}),
  };
}

/**
 * Translates any outbound v1 wire stream event/result to the v0.3 wire shape
 * for a v0.3 peer. Messages, Tasks, and status/artifact update events are all
 * handled; unrecognized shapes pass through unchanged.
 */
export function v1EventToV03(event: A2AWireStreamEvent): Record<string, unknown> {
  if (isWireTask(event)) return v1TaskToV03(event);
  if (isWireArtifactUpdate(event)) return v1ArtifactUpdateToV03(event);
  if (isWireStatusUpdate(event)) return v1StatusUpdateToV03(event);
  if (isWireMessage(event)) return v1MessageToV03(event) as unknown as Record<string, unknown>;
  return event as unknown as Record<string, unknown>;
}

export { V1_TO_V03_STATE, V03_TO_V1_STATE };
export type { V03Message, V03Part, V03TaskState };
