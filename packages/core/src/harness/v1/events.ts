/**
 * Harness v1 — event surface (§10).
 *
 * `HarnessEvent` is a discriminated union of every event the harness can
 * emit. Every event flows through `EventEmitter.emit()`; subscribers see
 * a fully-stamped event with `id`, `timestamp`, and (where relevant)
 * `sessionId`.
 *
 * IDs are scoped to an emitter: `<epoch>-<seq>`. The epoch is regenerated
 * whenever the emitter is constructed (i.e. process start, eviction +
 * rehydration), so SSE clients can detect a regenerated emitter and reset
 * their replay cursor (§10.5).
 *
 * Subscribers see only events emitted after `subscribe()` returns; there is
 * no automatic backfill. Callers that need history go through
 * `listMessages()` or the in-memory replay buffer (M5).
 */

import { randomUUID } from 'node:crypto';

import type { PendingResume, SessionRecord } from '../../storage/domains/harness';
import type { TaskItem } from '../../tools/builtin/shared';

import { HarnessEventSerializationError, HarnessValidationError } from './errors';
import type { EventSerializationReason } from './errors';
import type { SessionLifecycleState } from './session';

// ---------------------------------------------------------------------------
// Event base.
// ---------------------------------------------------------------------------

/**
 * Common fields stamped on every event. `sessionId` is set when the event
 * originated on a Session emitter; harness-level events (registry, lifecycle
 * across all sessions, intervals) leave it unset.
 *
 * `signalId` correlates an event back to the `message()` call that produced
 * it. `queuedItemId` correlates events back to a `queue()` item. Subagent
 * events also carry `subagentSessionId` so a parent subscriber can route by
 * origin (§10.6).
 */
export interface HarnessEventBase {
  /** Monotonic-within-emitter id formatted as `<epoch>-<seq>`. */
  id: string;
  timestamp: number;
  sessionId?: string;
  subagentSessionId?: string;
  runId?: string;
  signalId?: string;
  queuedItemId?: string;
}

// ---------------------------------------------------------------------------
// Lifecycle / state events (§10.2).
// ---------------------------------------------------------------------------

export interface SessionCreatedEvent extends HarnessEventBase {
  type: 'session_created';
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  modeId: string;
  modelId: string;
}

export interface SessionClosedEvent extends HarnessEventBase {
  type: 'session_closed';
  reason: 'requested' | 'shutdown';
}

export interface SessionEvictedEvent extends HarnessEventBase {
  type: 'session_evicted';
  reason: 'idle' | 'pressure' | 'pinned_timeout' | 'shutdown';
}

export interface ModeChangedEvent extends HarnessEventBase {
  type: 'mode_changed';
  modeId: string;
  previousModeId: string;
}

export interface ModelChangedEvent extends HarnessEventBase {
  type: 'model_changed';
  modelId: string;
  previousModelId: string;
}

export interface StateChangedEvent extends HarnessEventBase {
  type: 'state_changed';
  changedKeys: string[];
}

// ---------------------------------------------------------------------------
// Turn events (§10.2).
// ---------------------------------------------------------------------------

export interface AgentStartEvent extends HarnessEventBase {
  type: 'agent_start';
}

/**
 * Assistant message lifecycle (§10.2).
 *
 * Each assistant message produced inside a turn gets exactly one
 * `message_start`, zero or more `message_update` (text deltas), and one
 * `message_end`. `messageId` is stable across the trio and matches the
 * ai-sdk text-stream id, so a UI can address an in-flight message slot
 * directly.
 */
export interface MessageStartEvent extends HarnessEventBase {
  type: 'message_start';
  messageId: string;
}

export interface MessageUpdateEvent extends HarnessEventBase {
  type: 'message_update';
  messageId: string;
  delta: string;
}

export interface MessageEndEvent extends HarnessEventBase {
  type: 'message_end';
  messageId: string;
}

/**
 * Tool-input streaming (§10.2). Models that build arguments incrementally
 * surface a `tool_input_start` → N × `tool_input_delta` → `tool_input_end`
 * sequence before the actual `tool_start`. Models that emit a complete
 * `tool-call` chunk in one shot skip the triplet entirely; clients must
 * tolerate either shape.
 */
export interface ToolInputStartEvent extends HarnessEventBase {
  type: 'tool_input_start';
  toolCallId: string;
  toolName: string;
}

export interface ToolInputDeltaEvent extends HarnessEventBase {
  type: 'tool_input_delta';
  toolCallId: string;
  argsTextDelta: string;
  toolName?: string;
}

export interface ToolInputEndEvent extends HarnessEventBase {
  type: 'tool_input_end';
  toolCallId: string;
}

export interface ToolStartEvent extends HarnessEventBase {
  type: 'tool_start';
  toolCallId: string;
  toolName: string;
  args: unknown;
}

/**
 * Tool progress (§10.2). Long-running tools (shell, downloads, codegen)
 * publish incremental `partialResult`s between `tool_start` and `tool_end`.
 *
 * Source of truth is the `data-tool-update` chunk that tools write via
 * `ctx.writer?.custom({ type: 'data-tool-update', data: { toolCallId, partialResult } })` —
 * the same call works outside a Harness, where consumers read the chunk
 * directly from `agent.stream().fullStream`. Inside a Harness,
 * `_drainStreamToEvents` recognizes the whitelisted `data-tool-update`
 * chunk type and bridges it into this typed event so subscribers can
 * switch on `event.type === 'tool_update'`.
 */
export interface ToolUpdateEvent extends HarnessEventBase {
  type: 'tool_update';
  toolCallId: string;
  partialResult: unknown;
}

/**
 * Streaming shell output (§10.2). Tools that wrap a child process publish
 * stdout/stderr chunks via
 * `ctx.writer?.custom({ type: 'data-shell-output', data: { toolCallId, output, stream } })`.
 * Inside a Harness, `_drainStreamToEvents` bridges the whitelisted
 * `data-shell-output` chunk into this typed event. Outside a Harness, the
 * chunk surfaces directly on `agent.stream().fullStream`.
 */
export interface ShellOutputEvent extends HarnessEventBase {
  type: 'shell_output';
  toolCallId: string;
  output: string;
  stream: 'stdout' | 'stderr';
}

/**
 * Task list update (§10.2). Surfaces a new task list to subscribers
 * (TUI progress widget, sidebar, observers).
 *
 * Source of truth is the `data-task-updated` chunk that tools write via
 * `ctx.writer?.custom({ type: 'data-task-updated', data: { tasks } })` —
 * the same call works outside a Harness, where consumers read the chunk
 * directly from `agent.stream().fullStream`. Inside a Harness,
 * `_drainStreamToEvents` recognizes the whitelisted `data-task-updated`
 * chunk type and bridges it into this typed event so subscribers can
 * switch on `event.type === 'task_updated'`.
 *
 * The harness owns this event type — tools must not synthesize it through
 * `ctx.emitEvent`. Use `writer.custom` instead.
 */
export interface TaskUpdatedEvent extends HarnessEventBase {
  type: 'task_updated';
  tasks: TaskItem[];
}

export interface ToolEndEvent extends HarnessEventBase {
  type: 'tool_end';
  toolCallId: string;
  result: unknown;
  isError: boolean;
}

export interface AgentEndEvent extends HarnessEventBase {
  type: 'agent_end';
  reason: 'complete' | 'aborted' | 'error' | 'suspended';
}

// ---------------------------------------------------------------------------
// Suspension events (§10.2). Emitted after the durable-parking barrier so
// any subscriber observing the event can reconstruct the pending state from
// storage (§5.4).
// ---------------------------------------------------------------------------

export interface SuspensionRequiredEvent extends HarnessEventBase {
  type: 'suspension_required';
  kind: PendingResume['kind'];
  toolCallId: string;
  toolName?: string;
}

export interface SuspensionResolvedEvent extends HarnessEventBase {
  type: 'suspension_resolved';
  kind: PendingResume['kind'];
  toolCallId: string;
}

// ---------------------------------------------------------------------------
// Queue events (§10.2). The queue's lifecycle is: `enqueued → started →
// removed`. Outcome is observable through the turn's own `agent_end`
// (correlated by `queuedItemId`) and the resolved/rejected `queue()` promise,
// so we don't emit `queue_item_completed` / `queue_item_failed` — that would
// be a redundant restatement of `agent_end`.
//
//   - `queue_item_started`  — drain pulled the head item; turn is about to
//                             begin under a fresh `runId`.
//   - `queue_item_replayed` — same, but emitted instead of `started` when
//                             the source is crash-recovery rather than a
//                             live `queue()` call. The original caller's
//                             promise is gone; events flow but no resolver
//                             settles.
// ---------------------------------------------------------------------------

export interface QueueItemStartedEvent extends HarnessEventBase {
  type: 'queue_item_started';
  queuedItemId: string;
}

export interface QueueItemReplayedEvent extends HarnessEventBase {
  type: 'queue_item_replayed';
  queuedItemId: string;
}

// ---------------------------------------------------------------------------
// Custom events (§10.3) — escape hatch for callers that want to attach their
// own typed events to the same subscription channel. Type must be dotted
// and not start with the reserved harness prefix; payload must be JSON-
// serializable.
// ---------------------------------------------------------------------------

export interface CustomEvent extends HarnessEventBase {
  type: `${string}.${string}`;
  payload?: unknown;
}

// ---------------------------------------------------------------------------
// Thread lifecycle events (§10.2 — sidebar surface).
//
// Threads are the durable artifact (message log + title), distinct from
// the runtime Session. These events fire on the harness emitter so a
// sidebar can be reactive without polling. `thread_deleted` fires AFTER
// any cascade-close of the active session, so subscribers see the
// session_closed event first.
// ---------------------------------------------------------------------------

export interface ThreadCreatedEvent extends HarnessEventBase {
  type: 'thread_created';
  threadId: string;
  resourceId: string;
  title?: string;
}

export interface ThreadRenamedEvent extends HarnessEventBase {
  type: 'thread_renamed';
  threadId: string;
  resourceId: string;
  title: string;
  previousTitle?: string;
}

export interface ThreadDeletedEvent extends HarnessEventBase {
  type: 'thread_deleted';
  threadId: string;
  resourceId: string;
  /** True when a live session was cascaded-closed as part of the delete. */
  cascadedSessionClose: boolean;
}

export interface ThreadClonedEvent extends HarnessEventBase {
  type: 'thread_cloned';
  threadId: string;
  resourceId: string;
  sourceThreadId: string;
  title?: string;
}

export type HarnessEvent =
  | SessionCreatedEvent
  | SessionClosedEvent
  | SessionEvictedEvent
  | ModeChangedEvent
  | ModelChangedEvent
  | StateChangedEvent
  | AgentStartEvent
  | MessageStartEvent
  | MessageUpdateEvent
  | MessageEndEvent
  | ToolInputStartEvent
  | ToolInputDeltaEvent
  | ToolInputEndEvent
  | ToolStartEvent
  | ToolUpdateEvent
  | ShellOutputEvent
  | TaskUpdatedEvent
  | ToolEndEvent
  | AgentEndEvent
  | SuspensionRequiredEvent
  | SuspensionResolvedEvent
  | QueueItemStartedEvent
  | QueueItemReplayedEvent
  | ThreadCreatedEvent
  | ThreadRenamedEvent
  | ThreadDeletedEvent
  | ThreadClonedEvent
  | CustomEvent;

export type HarnessEventListener = (event: HarnessEvent) => void | Promise<void>;
export type HarnessEventUnsubscribe = () => void;

// ---------------------------------------------------------------------------
// Emitter.
// ---------------------------------------------------------------------------

/**
 * Shape of an event before `emit()` stamps the framework fields. Callers
 * provide the type-discriminated payload; the emitter fills in `id`,
 * `timestamp`, `sessionId` (when configured), and (optionally)
 * `subagentSessionId` / `runId` / `signalId` / `queuedItemId`.
 *
 * Distributes Omit over the union so the discriminator is preserved.
 */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

export type EmitInput = DistributiveOmit<HarnessEvent, 'id' | 'timestamp' | 'sessionId'>;

/**
 * Per-emitter scope applied to every event the emitter publishes. Used so
 * the Session emitter automatically stamps `sessionId`; harness-level
 * emitters leave it unset.
 */
export interface EmitterScope {
  sessionId?: string;
}

/**
 * Tiny pub/sub primitive used by `Session` and `Harness`. Listeners are
 * dispatched in registration order. A throwing or rejecting listener is
 * isolated (logged to console) so a buggy subscriber cannot disrupt the
 * producer or other listeners.
 *
 * Event IDs are formatted `<epoch>-<seq>`; the epoch is a per-emitter UUID
 * regenerated on every construction. Clients that have buffered an `id`
 * from a previous epoch and rejoin can detect mismatch and reset.
 */
export class EventEmitter {
  private readonly listeners: HarnessEventListener[] = [];
  private readonly epoch: string = randomUUID();
  private seq = 0;
  private readonly scope: EmitterScope;

  constructor(scope: EmitterScope = {}) {
    this.scope = scope;
  }

  subscribe(listener: HarnessEventListener): HarnessEventUnsubscribe {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) this.listeners.splice(index, 1);
    };
  }

  emit(event: EmitInput, overrides?: { sessionId?: string }): HarnessEvent {
    const sessionId = overrides?.sessionId ?? this.scope.sessionId;
    const stamped = {
      ...event,
      id: `${this.epoch}-${this.seq++}`,
      timestamp: Date.now(),
      ...(sessionId !== undefined && { sessionId }),
    } as HarnessEvent;
    this.dispatch(stamped);
    return stamped;
  }

  /**
   * Re-emit an already-stamped event (e.g. when a Harness bridges a Session
   * event into its own subscriber pool). The original `id` / `timestamp` /
   * `sessionId` are preserved; the bridging emitter does NOT re-stamp.
   */
  forward(event: HarnessEvent): void {
    this.dispatch(event);
  }

  /** Number of currently registered listeners — for tests. */
  get listenerCount(): number {
    return this.listeners.length;
  }

  /** Current epoch id — for tests and for diagnostics on rehydrate. */
  get epochId(): string {
    return this.epoch;
  }

  private dispatch(event: HarnessEvent): void {
    for (const listener of this.listeners) {
      try {
        const result = listener(event);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(err => console.error('[harness/v1] event listener rejected:', err));
        }
      } catch (err) {
        console.error('[harness/v1] event listener threw:', err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers consumed by Session/Harness.
// ---------------------------------------------------------------------------

/**
 * Map `pendingResume.kind` to the suspension event kind. Emitted by
 * `Session` after the pending record commits.
 */
export function suspensionRequiredFor(pending: PendingResume): SuspensionRequiredEvent {
  return {
    type: 'suspension_required',
    id: '',
    timestamp: 0,
    kind: pending.kind,
    toolCallId: pending.toolCallId,
    toolName: pending.toolName,
  } as SuspensionRequiredEvent;
}

/**
 * Map a `SessionRecord` to the payload of `session_created`. Centralized so
 * the Session and Harness emit identical fields.
 */
export function sessionCreatedPayload(
  record: SessionRecord,
): Omit<SessionCreatedEvent, keyof HarnessEventBase | 'type'> {
  return {
    resourceId: record.resourceId,
    threadId: record.threadId,
    parentSessionId: record.parentSessionId,
    modeId: record.modeId,
    modelId: record.modelId,
  };
}

// ---------------------------------------------------------------------------
// Reserved-event metadata (§6.2, §10.3).
//
// Tools emit data via `ctx.writer?.custom({ type: 'data-*', data })` and
// the harness whitelists known `data-*` chunk types in `_drainStreamToEvents`
// to bridge them into typed events. These reserved sets capture the names
// the harness owns so future custom-event surfaces can validate against
// them as a single source of truth.
// ---------------------------------------------------------------------------

/** Harness-owned event types — exhaustive list per spec §6.2 / §10.2. */
const RESERVED_EVENT_TYPES: ReadonlySet<string> = new Set([
  'session_created',
  'session_closed',
  'session_evicted',
  'session_pin_overflow',
  'mode_changed',
  'model_changed',
  'state_changed',
  'agent_start',
  'agent_end',
  'message_start',
  'message_update',
  'message_end',
  'tool_input_start',
  'tool_input_delta',
  'tool_input_end',
  'tool_start',
  'tool_update',
  'shell_output',
  'task_updated',
  'tool_end',
  'suspension_required',
  'suspension_resolved',
  'queue_item_started',
  'queue_item_replayed',
  'queue_item_failed',
  'queue_item_completed',
  'thread_created',
  'thread_renamed',
  'thread_deleted',
  'thread_cloned',
  'goal_set',
  'goal_judged',
  'goal_done',
  'goal_paused',
  'goal_cleared',
  'workspace_status_changed',
  'workspace_error',
]);

/** Prefixes reserved for built-in event families (subagent_*, goal_*, etc.). */
const RESERVED_EVENT_PREFIXES: readonly string[] = [
  'subagent_',
  'goal_',
  'queue_',
  'session_',
  'workspace_',
  'thread_',
];

/**
 * Throws `HarnessValidationError` if `type` collides with a harness-owned
 * event type or omits the required dotted prefix. Custom events must follow
 * `<namespace>.<rest>` per spec §10.3.
 */
export function assertCustomEventType(type: string): void {
  if (RESERVED_EVENT_TYPES.has(type)) {
    throw new HarnessValidationError('event.type', `"${type}" is a reserved harness event type`);
  }
  for (const prefix of RESERVED_EVENT_PREFIXES) {
    if (type.startsWith(prefix)) {
      throw new HarnessValidationError(
        'event.type',
        `"${type}" uses reserved prefix "${prefix}*" — custom events need a different namespace`,
      );
    }
  }
  if (!type.includes('.')) {
    throw new HarnessValidationError(
      'event.type',
      `custom event "${type}" must be dotted (e.g. "myorg.tool.progress")`,
    );
  }
}

/**
 * Walks an event payload and throws `HarnessEventSerializationError` on the
 * first non-JSON-serializable value. Catches functions, Symbols, BigInts,
 * Dates, Map/Set, typed arrays, class instances with a non-plain prototype,
 * `undefined`, and cyclic refs.
 *
 * `sessionId` is threaded through purely for the error payload.
 */
export function assertJsonSerializable(eventType: string, sessionId: string | undefined, value: unknown): void {
  const seen = new WeakSet<object>();
  walk(value, 'event');

  function fail(path: string, reason: EventSerializationReason): never {
    throw new HarnessEventSerializationError(sessionId, eventType, path, reason);
  }

  function walk(node: unknown, path: string): void {
    if (node === null) return;
    const t = typeof node;
    if (t === 'string' || t === 'number' || t === 'boolean') return;
    if (t === 'undefined') return fail(path, 'undefined');
    if (t === 'function') return fail(path, 'function');
    if (t === 'symbol') return fail(path, 'symbol');
    if (t === 'bigint') return fail(path, 'bigint');

    if (Array.isArray(node)) {
      if (seen.has(node)) return fail(path, 'cyclic');
      seen.add(node);
      for (let i = 0; i < node.length; i++) walk(node[i], `${path}[${i}]`);
      return;
    }

    if (node instanceof Date) return fail(path, 'date');
    if (node instanceof Map) return fail(path, 'map');
    if (node instanceof Set) return fail(path, 'set');
    if (ArrayBuffer.isView(node) || node instanceof ArrayBuffer) return fail(path, 'typed-array');

    if (t === 'object') {
      const proto = Object.getPrototypeOf(node);
      if (proto !== null && proto !== Object.prototype) {
        return fail(path, 'class-instance');
      }
      if (seen.has(node as object)) return fail(path, 'cyclic');
      seen.add(node as object);
      for (const key of Object.keys(node as object)) {
        walk((node as Record<string, unknown>)[key], `${path}.${key}`);
      }
      return;
    }

    fail(path, 'unknown');
  }
}

// Re-export so consumers that import HarnessEvent get the lifecycle import for free.
export type { SessionLifecycleState };
