/**
 * A2A protocol v1 WIRE JSON shapes.
 *
 * `@a2a-js/sdk` v1 exports in-memory protobuf types (numeric enums,
 * `{ content: { $case } }` parts). Those are the runtime representation used by
 * the SDK's own transports — NOT the JSON shape that actually goes over the
 * wire. The {@link A2AAgent} client speaks HTTP/JSON-RPC directly, so it works
 * with the wire JSON shapes described here.
 *
 * Key differences from v0.3:
 *  - No `kind` discriminators on Message / Task / Part / events.
 *  - `Message.role` is `'ROLE_USER' | 'ROLE_AGENT'` (v0.3 used `'user'|'agent'`).
 *  - `Task.status.state` is a `TASK_STATE_*` wire string (v0.3 used
 *    `'completed'|'failed'|...`).
 *  - Text parts are `{ text }`, file parts are `{ raw }` / `{ url }`, data parts
 *    are `{ data }` — each optionally with `mediaType` / `filename`.
 */

/** v1 wire task lifecycle state strings. */
export type WireTaskState =
  | 'TASK_STATE_UNSPECIFIED'
  | 'TASK_STATE_SUBMITTED'
  | 'TASK_STATE_WORKING'
  | 'TASK_STATE_COMPLETED'
  | 'TASK_STATE_FAILED'
  | 'TASK_STATE_CANCELED'
  | 'TASK_STATE_INPUT_REQUIRED'
  | 'TASK_STATE_REJECTED'
  | 'TASK_STATE_AUTH_REQUIRED';

/** v1 wire message role strings. */
export type WireRole = 'ROLE_USER' | 'ROLE_AGENT';

/** A text part on the wire. */
export interface WireTextPart {
  text: string;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

/** A raw (base64-encoded) file part on the wire. */
export interface WireRawFilePart {
  raw: string;
  filename?: string;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

/** A URL-referenced file part on the wire. */
export interface WireUrlFilePart {
  url: string;
  filename?: string;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

/** A structured data part on the wire. */
export interface WireDataPart {
  data: Record<string, unknown> | unknown[] | string | number | boolean | null;
  mediaType?: string;
  metadata?: Record<string, unknown>;
}

export type WirePart = WireTextPart | WireRawFilePart | WireUrlFilePart | WireDataPart;

/** A message on the wire (no `kind`). */
export interface WireMessage {
  messageId: string;
  role: WireRole;
  parts: WirePart[];
  contextId?: string;
  taskId?: string;
  referenceTaskIds?: string[];
  extensions?: string[];
  metadata?: Record<string, unknown>;
}

/** An artifact on the wire. */
export interface WireArtifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts?: WirePart[];
  metadata?: Record<string, unknown>;
}

/** Task status container on the wire. */
export interface WireTaskStatus {
  state: WireTaskState;
  message?: WireMessage;
  timestamp?: string;
}

/** A task on the wire (no `kind`). */
export interface WireTask {
  id: string;
  contextId: string;
  status: WireTaskStatus;
  artifacts?: WireArtifact[];
  history?: WireMessage[];
  metadata?: Record<string, unknown>;
}

/** Status update stream event on the wire (no `kind` / `final`). */
export interface WireTaskStatusUpdateEvent {
  taskId: string;
  contextId: string;
  status: WireTaskStatus;
  metadata?: Record<string, unknown>;
}

/** Artifact update stream event on the wire (no `kind`). */
export interface WireTaskArtifactUpdateEvent {
  taskId: string;
  contextId: string;
  artifact: WireArtifact;
  append?: boolean;
  lastChunk?: boolean;
  metadata?: Record<string, unknown>;
}

export type WireStreamEvent = WireMessage | WireTask | WireTaskStatusUpdateEvent | WireTaskArtifactUpdateEvent;

/** Terminal (non-resumable) wire task states. */
const TERMINAL_WIRE_STATES = new Set<WireTaskState>([
  'TASK_STATE_COMPLETED',
  'TASK_STATE_FAILED',
  'TASK_STATE_CANCELED',
  'TASK_STATE_REJECTED',
]);

export function isTerminalWireTaskState(state: WireTaskState | undefined): boolean {
  return state !== undefined && TERMINAL_WIRE_STATES.has(state);
}

export function isTextPart(part: WirePart): part is WireTextPart {
  return 'text' in part && typeof (part as WireTextPart).text === 'string';
}

/**
 * Structurally identify a v1 wire Task: it has `status`, `id` and `contextId`
 * and, crucially, no `messageId` (which would make it a Message).
 */
export function isWireTask(value: WireStreamEvent): value is WireTask {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'id' in value &&
    'contextId' in value &&
    !('messageId' in value)
  );
}

/** Structurally identify a v1 wire Message: it has `messageId` and `parts`. */
export function isWireMessage(value: WireStreamEvent): value is WireMessage {
  return typeof value === 'object' && value !== null && 'messageId' in value && 'parts' in value;
}

/**
 * Structurally identify a v1 artifact-update event: it carries an `artifact`
 * property (and a `taskId`) but is neither a Task nor a Message.
 */
export function isWireArtifactUpdate(value: WireStreamEvent): value is WireTaskArtifactUpdateEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'artifact' in value &&
    'taskId' in value &&
    !('messageId' in value) &&
    !('id' in value)
  );
}

/**
 * Structurally identify a v1 status-update event: it carries a `status`
 * property (and a `taskId`) but no `id` (which would make it a Task).
 */
export function isWireStatusUpdate(value: WireStreamEvent): value is WireTaskStatusUpdateEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'taskId' in value &&
    !('id' in value) &&
    !('messageId' in value)
  );
}

// === v0.3 <-> v1 wire translation ============================================

/** Peer protocol version derived from the selected interface. */
export type PeerVersion = '1.0' | '0.3';

/** Legacy v0.3 wire part shapes (with `kind` discriminators). */
type LegacyTextPart = { kind: 'text'; text: string; metadata?: Record<string, unknown> };
type LegacyFilePart = {
  kind: 'file';
  file: { bytes?: string; uri?: string; name?: string; mimeType?: string };
  metadata?: Record<string, unknown>;
};
type LegacyDataPart = { kind: 'data'; data: unknown; metadata?: Record<string, unknown> };
type LegacyPart = LegacyTextPart | LegacyFilePart | LegacyDataPart;

const LEGACY_TO_V1_STATE: Record<string, WireTaskState> = {
  unknown: 'TASK_STATE_UNSPECIFIED',
  submitted: 'TASK_STATE_SUBMITTED',
  working: 'TASK_STATE_WORKING',
  completed: 'TASK_STATE_COMPLETED',
  failed: 'TASK_STATE_FAILED',
  canceled: 'TASK_STATE_CANCELED',
  'input-required': 'TASK_STATE_INPUT_REQUIRED',
  rejected: 'TASK_STATE_REJECTED',
  'auth-required': 'TASK_STATE_AUTH_REQUIRED',
};

/** Convert a v1 wire part to its v0.3 shape. */
function wirePartToLegacy(part: WirePart): LegacyPart {
  if (isTextPart(part)) {
    return { kind: 'text', text: part.text, ...(part.metadata ? { metadata: part.metadata } : {}) };
  }

  if ('raw' in part) {
    return {
      kind: 'file',
      file: {
        bytes: part.raw,
        ...(part.filename ? { name: part.filename } : {}),
        ...(part.mediaType ? { mimeType: part.mediaType } : {}),
      },
      ...(part.metadata ? { metadata: part.metadata } : {}),
    };
  }

  if ('url' in part) {
    return {
      kind: 'file',
      file: {
        uri: part.url,
        ...(part.filename ? { name: part.filename } : {}),
        ...(part.mediaType ? { mimeType: part.mediaType } : {}),
      },
      ...(part.metadata ? { metadata: part.metadata } : {}),
    };
  }

  return { kind: 'data', data: part.data, ...(part.metadata ? { metadata: part.metadata } : {}) };
}

/** Convert a v0.3 wire part to its v1 shape. */
function legacyPartToWire(part: LegacyPart): WirePart {
  if (part.kind === 'text') {
    return { text: part.text, ...(part.metadata ? { metadata: part.metadata } : {}) };
  }

  if (part.kind === 'file') {
    const { bytes, uri, name, mimeType } = part.file ?? {};
    if (typeof uri === 'string') {
      return {
        url: uri,
        ...(name ? { filename: name } : {}),
        ...(mimeType ? { mediaType: mimeType } : {}),
        ...(part.metadata ? { metadata: part.metadata } : {}),
      };
    }
    return {
      raw: bytes ?? '',
      ...(name ? { filename: name } : {}),
      ...(mimeType ? { mediaType: mimeType } : {}),
      ...(part.metadata ? { metadata: part.metadata } : {}),
    };
  }

  return {
    data: part.data as WireDataPart['data'],
    ...(part.metadata ? { metadata: part.metadata } : {}),
  };
}

/** Convert a v1 wire message to the v0.3 message shape (adds `kind`, maps role/parts). */
export function wireMessageToLegacy(message: WireMessage): Record<string, unknown> {
  return {
    kind: 'message',
    messageId: message.messageId,
    role: message.role === 'ROLE_AGENT' ? 'agent' : 'user',
    parts: message.parts.map(wirePartToLegacy),
    ...(message.contextId ? { contextId: message.contextId } : {}),
    ...(message.taskId ? { taskId: message.taskId } : {}),
    ...(message.referenceTaskIds?.length ? { referenceTaskIds: message.referenceTaskIds } : {}),
    ...(message.extensions?.length ? { extensions: message.extensions } : {}),
    ...(message.metadata ? { metadata: message.metadata } : {}),
  };
}

function legacyMessageToWire(message: Record<string, unknown>): WireMessage {
  const parts = Array.isArray(message.parts) ? (message.parts as LegacyPart[]) : [];
  return {
    messageId: (message.messageId as string) ?? '',
    role: message.role === 'agent' ? 'ROLE_AGENT' : 'ROLE_USER',
    parts: parts.map(legacyPartToWire),
    ...(typeof message.contextId === 'string' ? { contextId: message.contextId } : {}),
    ...(typeof message.taskId === 'string' ? { taskId: message.taskId } : {}),
    ...(Array.isArray(message.referenceTaskIds) ? { referenceTaskIds: message.referenceTaskIds as string[] } : {}),
    ...(Array.isArray(message.extensions) ? { extensions: message.extensions as string[] } : {}),
    ...(message.metadata && typeof message.metadata === 'object'
      ? { metadata: message.metadata as Record<string, unknown> }
      : {}),
  };
}

function legacyArtifactToWire(artifact: Record<string, unknown>): WireArtifact {
  const parts = Array.isArray(artifact.parts) ? (artifact.parts as LegacyPart[]) : undefined;
  return {
    artifactId: (artifact.artifactId as string) ?? '',
    ...(typeof artifact.name === 'string' ? { name: artifact.name } : {}),
    ...(typeof artifact.description === 'string' ? { description: artifact.description } : {}),
    ...(parts ? { parts: parts.map(legacyPartToWire) } : {}),
    ...(artifact.metadata && typeof artifact.metadata === 'object'
      ? { metadata: artifact.metadata as Record<string, unknown> }
      : {}),
  };
}

function legacyStatusToWire(status: Record<string, unknown> | undefined): WireTaskStatus {
  const legacyState = typeof status?.state === 'string' ? status.state : 'unknown';
  const message =
    status?.message && typeof status.message === 'object'
      ? legacyMessageToWire(status.message as Record<string, unknown>)
      : undefined;
  return {
    state: LEGACY_TO_V1_STATE[legacyState] ?? 'TASK_STATE_UNSPECIFIED',
    ...(message ? { message } : {}),
    ...(typeof status?.timestamp === 'string' ? { timestamp: status.timestamp } : {}),
  };
}

function legacyTaskToWire(task: Record<string, unknown>): WireTask {
  const artifacts = Array.isArray(task.artifacts) ? (task.artifacts as Record<string, unknown>[]) : undefined;
  const history = Array.isArray(task.history) ? (task.history as Record<string, unknown>[]) : undefined;
  return {
    id: (task.id as string) ?? '',
    contextId: (task.contextId as string) ?? '',
    status: legacyStatusToWire(task.status as Record<string, unknown> | undefined),
    ...(artifacts ? { artifacts: artifacts.map(legacyArtifactToWire) } : {}),
    ...(history ? { history: history.map(legacyMessageToWire) } : {}),
    ...(task.metadata && typeof task.metadata === 'object'
      ? { metadata: task.metadata as Record<string, unknown> }
      : {}),
  };
}

/**
 * Normalize an inbound wire value from a v0.3 peer into the v1 wire shapes the
 * client works with internally. v1 peers already produce v1 shapes and are
 * passed through untouched.
 */
export function normalizeInboundEvent(value: WireStreamEvent, peerVersion: PeerVersion): WireStreamEvent {
  if (peerVersion === '1.0' || typeof value !== 'object' || value === null) {
    return value;
  }

  const record = value as unknown as Record<string, unknown>;
  const kind = record.kind;

  if (kind === 'task' || ('status' in record && 'id' in record && !('messageId' in record))) {
    return legacyTaskToWire(record);
  }

  if (kind === 'message' || ('messageId' in record && 'parts' in record)) {
    return legacyMessageToWire(record);
  }

  if (kind === 'artifact-update' || ('artifact' in record && 'taskId' in record)) {
    return {
      taskId: (record.taskId as string) ?? '',
      contextId: (record.contextId as string) ?? '',
      artifact: legacyArtifactToWire((record.artifact as Record<string, unknown>) ?? {}),
      ...(typeof record.append === 'boolean' ? { append: record.append } : {}),
      ...(typeof record.lastChunk === 'boolean' ? { lastChunk: record.lastChunk } : {}),
      ...(record.metadata && typeof record.metadata === 'object'
        ? { metadata: record.metadata as Record<string, unknown> }
        : {}),
    } satisfies WireTaskArtifactUpdateEvent;
  }

  if (kind === 'status-update' || ('status' in record && 'taskId' in record)) {
    return {
      taskId: (record.taskId as string) ?? '',
      contextId: (record.contextId as string) ?? '',
      status: legacyStatusToWire(record.status as Record<string, unknown> | undefined),
      ...(record.metadata && typeof record.metadata === 'object'
        ? { metadata: record.metadata as Record<string, unknown> }
        : {}),
    } satisfies WireTaskStatusUpdateEvent;
  }

  return value;
}
