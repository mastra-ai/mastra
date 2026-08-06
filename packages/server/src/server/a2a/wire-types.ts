/**
 * A2A protocol v1 **wire-JSON** types — the plain-object shapes that actually
 * cross the HTTP/JSON-RPC boundary, as produced by the `@a2a-js/sdk` v1
 * `MessageFns.toJSON` codecs (and accepted by `fromJSON`).
 *
 * IMPORTANT: these are NOT the SDK's in-memory protobuf types. In memory the
 * SDK models a `Part` as `{ content: { $case: 'text', value } }` with numeric
 * enums; on the wire that same part is `{ text: '…' }` and `TaskState` is a
 * string like `"TASK_STATE_WORKING"`. Mastra hand-rolls its own JSON-RPC server
 * and fetch client, so it works with the wire shapes directly and only reaches
 * for the SDK codecs / compat translators at the edges.
 *
 * To guard against drift from the SDK, `a2a/wire-types.test.ts` round-trips
 * representative objects of these shapes through the SDK `fromJSON` codecs.
 */

/** v1 task lifecycle states, as serialized on the wire (`taskStateToJSON`). */
export type A2ATaskStateWire =
  | 'TASK_STATE_SUBMITTED'
  | 'TASK_STATE_WORKING'
  | 'TASK_STATE_COMPLETED'
  | 'TASK_STATE_FAILED'
  | 'TASK_STATE_CANCELED'
  | 'TASK_STATE_INPUT_REQUIRED'
  | 'TASK_STATE_REJECTED'
  | 'TASK_STATE_AUTH_REQUIRED'
  | 'TASK_STATE_UNSPECIFIED';

/** v1 message sender role, as serialized on the wire (`roleToJSON`). */
export type A2ARoleWire = 'ROLE_USER' | 'ROLE_AGENT' | 'ROLE_UNSPECIFIED';

/** Terminal states — a task in one of these will not transition further. */
export const TERMINAL_TASK_STATES: readonly A2ATaskStateWire[] = [
  'TASK_STATE_COMPLETED',
  'TASK_STATE_FAILED',
  'TASK_STATE_CANCELED',
  'TASK_STATE_REJECTED',
];

/** Interrupted states — the agent is waiting for something before continuing. */
export const INTERRUPTED_TASK_STATES: readonly A2ATaskStateWire[] = [
  'TASK_STATE_INPUT_REQUIRED',
  'TASK_STATE_AUTH_REQUIRED',
];

/**
 * v1 wire `Part`. The `$case` discriminator of the in-memory type collapses to
 * a single content key on the wire (`text` | `raw` | `url` | `data`). There is
 * no `kind` field in v1.
 */
export type A2AWirePart =
  | { text: string; mediaType?: string; metadata?: Record<string, unknown> }
  | { raw: string; filename?: string; mediaType?: string; metadata?: Record<string, unknown> }
  | { url: string; filename?: string; mediaType?: string; metadata?: Record<string, unknown> }
  | { data: Record<string, unknown> | unknown[]; mediaType?: string; metadata?: Record<string, unknown> };

export interface A2AWireMessage {
  messageId: string;
  role: A2ARoleWire;
  parts: A2AWirePart[];
  contextId?: string;
  taskId?: string;
  referenceTaskIds?: string[];
  extensions?: string[];
  metadata?: Record<string, unknown>;
}

export interface A2AWireArtifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: A2AWirePart[];
  metadata?: Record<string, unknown>;
  extensions?: string[];
}

export interface A2AWireTaskStatus {
  state: A2ATaskStateWire;
  message?: A2AWireMessage;
  timestamp?: string;
}

export interface A2AWireTask {
  id: string;
  contextId: string;
  status: A2AWireTaskStatus;
  artifacts?: A2AWireArtifact[];
  history?: A2AWireMessage[];
  metadata?: Record<string, unknown>;
}

export interface A2AWireTaskStatusUpdateEvent {
  taskId: string;
  contextId: string;
  status: A2AWireTaskStatus;
  metadata?: Record<string, unknown>;
}

export interface A2AWireTaskArtifactUpdateEvent {
  taskId: string;
  contextId: string;
  artifact: A2AWireArtifact;
  append?: boolean;
  lastChunk?: boolean;
  metadata?: Record<string, unknown>;
}

export type A2AWireStreamEvent =
  | A2AWireMessage
  | A2AWireTask
  | A2AWireTaskStatusUpdateEvent
  | A2AWireTaskArtifactUpdateEvent;

/** Narrows a wire part to a text part. */
export function isTextWirePart(part: A2AWirePart): part is Extract<A2AWirePart, { text: string }> {
  return typeof (part as { text?: unknown }).text === 'string';
}

/** Narrows a wire stream event to a Task. */
export function isWireTask(event: A2AWireStreamEvent): event is A2AWireTask {
  return 'status' in event && 'id' in event && 'contextId' in event && !('taskId' in event);
}

/** Narrows a wire stream event to a Message. */
export function isWireMessage(event: A2AWireStreamEvent): event is A2AWireMessage {
  return 'messageId' in event && 'parts' in event;
}

/** Narrows a wire stream event to an artifact-update event (v1 has no `kind`). */
export function isWireArtifactUpdate(event: A2AWireStreamEvent): event is A2AWireTaskArtifactUpdateEvent {
  return 'artifact' in event && 'taskId' in event;
}

/** Narrows a wire stream event to a status-update event (v1 has no `kind`). */
export function isWireStatusUpdate(event: A2AWireStreamEvent): event is A2AWireTaskStatusUpdateEvent {
  return 'status' in event && 'taskId' in event && !('artifact' in event);
}
