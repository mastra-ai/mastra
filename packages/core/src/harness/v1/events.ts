import { randomUUID } from 'node:crypto';

import type { TaskItem } from '../tools';
import { HarnessEventSerializationError, HarnessValidationError } from './errors';
import type { EventSerializationReason } from './errors';
import type { ToolCategory } from './shared';
import type { GoalJudgeDecision, GoalState, PendingResume, PermissionPolicy, SessionRecord } from './types';

export interface HarnessEventBase {
  id: string;
  timestamp: number;
  sessionId?: string;
  subagentSessionId?: string;
  runId?: string;
  signalId?: string;
  queuedItemId?: string;
}

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
  reason: 'idle' | 'pressure' | 'pinned_timeout' | 'shutdown' | 'lease_lost';
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

export interface ModelOverrideSetEvent extends HarnessEventBase {
  type: 'model_override_set';
  agentType: string;
  modelId: string;
  previousModelId: string | null;
}

export interface StateChangedEvent extends HarnessEventBase {
  type: 'state_changed';
  changedKeys: string[];
}

export interface PermissionGrantedEvent extends HarnessEventBase {
  type: 'permission_granted';
  category?: ToolCategory;
  toolName?: string;
}

export interface PermissionRevokedEvent extends HarnessEventBase {
  type: 'permission_revoked';
  category?: ToolCategory;
  toolName?: string;
}

export interface PermissionPolicyChangedEvent extends HarnessEventBase {
  type: 'permission_policy_changed';
  category?: ToolCategory;
  toolName?: string;
  oldPolicy: PermissionPolicy | null;
  newPolicy: PermissionPolicy;
}

export interface AgentStartEvent extends HarnessEventBase {
  type: 'agent_start';
}

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

export interface ToolUpdateEvent extends HarnessEventBase {
  type: 'tool_update';
  toolCallId: string;
  partialResult: unknown;
}

export interface ShellOutputEvent extends HarnessEventBase {
  type: 'shell_output';
  toolCallId: string;
  output: string;
  stream: 'stdout' | 'stderr';
}

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

export interface QueueItemStartedEvent extends HarnessEventBase {
  type: 'queue_item_started';
  queuedItemId: string;
}

export interface QueueItemReplayedEvent extends HarnessEventBase {
  type: 'queue_item_replayed';
  queuedItemId: string;
}

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
  cascadedSessionClose: boolean;
}

export interface ThreadClonedEvent extends HarnessEventBase {
  type: 'thread_cloned';
  threadId: string;
  resourceId: string;
  sourceThreadId: string;
  title?: string;
}

export interface ThreadSettingsChangedEvent extends HarnessEventBase {
  type: 'thread_settings_changed';
  threadId: string;
  resourceId: string;
  patch: Record<string, unknown>;
  removedKeys: string[];
}

export interface SubagentStartEvent extends HarnessEventBase {
  type: 'subagent_start';
  toolCallId: string;
  subagentSessionId: string;
  agentType: string;
  task: string;
  modelId: string;
  parentId?: string;
  depth: number;
}

export interface SubagentTextDeltaEvent extends HarnessEventBase {
  type: 'subagent_text_delta';
  toolCallId: string;
  subagentSessionId: string;
  agentType: string;
  delta: string;
  parentId?: string;
  depth: number;
}

export interface SubagentToolStartEvent extends HarnessEventBase {
  type: 'subagent_tool_start';
  toolCallId: string;
  subagentSessionId: string;
  agentType: string;
  innerToolCallId: string;
  toolName: string;
  parentId?: string;
  depth: number;
}

export interface SubagentToolEndEvent extends HarnessEventBase {
  type: 'subagent_tool_end';
  toolCallId: string;
  subagentSessionId: string;
  agentType: string;
  innerToolCallId: string;
  toolName: string;
  output: unknown;
  isError: boolean;
  parentId?: string;
  depth: number;
}

export interface SubagentEndEvent extends HarnessEventBase {
  type: 'subagent_end';
  toolCallId: string;
  subagentSessionId: string;
  agentType: string;
  output: unknown;
  isError: boolean;
  durationMs: number;
  parentId?: string;
  depth: number;
}

export interface GoalSetEvent extends HarnessEventBase {
  type: 'goal_set';
  goal: GoalState;
}

export interface GoalJudgedEvent extends HarnessEventBase {
  type: 'goal_judged';
  goalId: string;
  decision: GoalJudgeDecision;
  turnsUsed: number;
  maxTurns: number;
}

export interface GoalDoneEvent extends HarnessEventBase {
  type: 'goal_done';
  goalId: string;
  reason: string;
  turnsUsed: number;
}

export interface GoalPausedEvent extends HarnessEventBase {
  type: 'goal_paused';
  goalId: string;
  reason: 'requested' | 'budget_exhausted' | 'judge_failed';
}

export interface GoalResumedEvent extends HarnessEventBase {
  type: 'goal_resumed';
  goalId: string;
}

export interface GoalClearedEvent extends HarnessEventBase {
  type: 'goal_cleared';
  goalId: string;
}

export interface WorkspaceStatusChangedEvent extends HarnessEventBase {
  type: 'workspace_status_changed';
  sessionId?: string;
  resourceId?: string;
  providerId?: string;
  status: 'initializing' | 'ready' | 'destroying' | 'destroyed' | 'lost' | 'error';
}

export interface WorkspaceErrorEvent extends HarnessEventBase {
  type: 'workspace_error';
  sessionId?: string;
  resourceId?: string;
  providerId?: string;
  error: { name: string; message: string };
}

export interface CustomEvent extends HarnessEventBase {
  type: `${string}.${string}`;
  payload?: unknown;
}

export type HarnessEvent =
  | SessionCreatedEvent
  | SessionClosedEvent
  | SessionEvictedEvent
  | ModeChangedEvent
  | ModelChangedEvent
  | ModelOverrideSetEvent
  | StateChangedEvent
  | PermissionGrantedEvent
  | PermissionRevokedEvent
  | PermissionPolicyChangedEvent
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
  | ThreadSettingsChangedEvent
  | SubagentStartEvent
  | SubagentTextDeltaEvent
  | SubagentToolStartEvent
  | SubagentToolEndEvent
  | SubagentEndEvent
  | GoalSetEvent
  | GoalJudgedEvent
  | GoalDoneEvent
  | GoalPausedEvent
  | GoalResumedEvent
  | GoalClearedEvent
  | WorkspaceStatusChangedEvent
  | WorkspaceErrorEvent
  | CustomEvent;

export type HarnessEventListener = (event: HarnessEvent) => void | Promise<void>;
export type HarnessEventUnsubscribe = () => void;

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;

export type EmitInput = DistributiveOmit<HarnessEvent, 'id' | 'timestamp' | 'sessionId'>;

export interface EmitterScope {
  sessionId?: string;
}

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

  forward(event: HarnessEvent): void {
    this.dispatch(event);
  }

  get listenerCount(): number {
    return this.listeners.length;
  }

  get epochId(): string {
    return this.epoch;
  }

  private dispatch(event: HarnessEvent): void {
    for (const listener of [...this.listeners]) {
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

export function suspensionRequiredFor(pending: PendingResume): Omit<SuspensionRequiredEvent, keyof HarnessEventBase> {
  return {
    type: 'suspension_required',
    kind: pending.kind,
    toolCallId: pending.toolCallId,
    toolName: pending.toolName,
  };
}

export function sessionCreatedPayload(
  record: SessionRecord,
): Omit<SessionCreatedEvent, keyof HarnessEventBase | 'type'> {
  return {
    resourceId: record.resourceId,
    threadId: record.threadId,
    ...(record.parentSessionId !== undefined && { parentSessionId: record.parentSessionId }),
    modeId: record.modeId,
    modelId: record.modelId,
  };
}

const RESERVED_EVENT_TYPES: ReadonlySet<string> = new Set([
  'session_created',
  'session_closed',
  'session_evicted',
  'session_pin_overflow',
  'mode_changed',
  'model_changed',
  'model_override_set',
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
  'thread_settings_changed',
  'goal_set',
  'goal_judged',
  'goal_done',
  'goal_paused',
  'goal_resumed',
  'goal_cleared',
  'workspace_status_changed',
  'workspace_error',
  'permission_granted',
  'permission_revoked',
  'permission_policy_changed',
]);

const RESERVED_EVENT_PREFIXES: readonly string[] = [
  'subagent_',
  'goal_',
  'queue_',
  'session_',
  'workspace_',
  'thread_',
  'permission_',
];

export function assertCustomEventType(type: string): void {
  if (RESERVED_EVENT_TYPES.has(type)) {
    throw new HarnessValidationError('event.type', `"${type}" is a reserved harness event type`);
  }
  for (const prefix of RESERVED_EVENT_PREFIXES) {
    if (type.startsWith(prefix)) {
      throw new HarnessValidationError(
        'event.type',
        `"${type}" uses reserved prefix "${prefix}*" - custom events need a different namespace`,
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

export function assertJsonSerializable(eventType: string, sessionId: string | undefined, value: unknown): void {
  const seen = new WeakSet<object>();
  walk(value, 'event');

  function fail(path: string, reason: EventSerializationReason): never {
    throw new HarnessEventSerializationError(sessionId, eventType, path, reason);
  }

  function walk(node: unknown, path: string): void {
    if (node === null) return;
    const t = typeof node;
    if (t === 'string' || t === 'boolean') return;
    if (t === 'number') {
      if (!Number.isFinite(node)) return fail(path, 'non-finite-number');
      return;
    }
    if (t === 'undefined') return fail(path, 'undefined');
    if (t === 'function') return fail(path, 'function');
    if (t === 'symbol') return fail(path, 'symbol');
    if (t === 'bigint') return fail(path, 'bigint');

    if (Array.isArray(node)) {
      if (seen.has(node)) return fail(path, 'cyclic');
      seen.add(node);
      for (let i = 0; i < node.length; i++) walk(node[i], `${path}[${i}]`);
      seen.delete(node);
      return;
    }

    if (node instanceof Date) return fail(path, 'date');
    if (node instanceof Map) return fail(path, 'map');
    if (node instanceof Set) return fail(path, 'set');
    if (ArrayBuffer.isView(node) || node instanceof ArrayBuffer) return fail(path, 'typed-array');

    if (t === 'object') {
      const proto = Object.getPrototypeOf(node);
      if (proto !== null && proto !== Object.prototype) return fail(path, 'class-instance');
      if (seen.has(node as object)) return fail(path, 'cyclic');
      seen.add(node as object);
      for (const key of Object.keys(node as object)) {
        walk((node as Record<string, unknown>)[key], `${path}.${key}`);
      }
      seen.delete(node as object);
      return;
    }

    fail(path, 'unknown');
  }
}
