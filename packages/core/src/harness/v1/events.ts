import { randomUUID } from 'node:crypto';

import type { HarnessPendingItemRecord, SessionRecord } from '../../storage/domains/harness';

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

export interface ThreadClonedEvent extends HarnessEventBase {
  type: 'thread_cloned';
  threadId: string;
  resourceId: string;
  sourceThreadId: string;
  title?: string;
}

export interface StateChangedEvent extends HarnessEventBase {
  type: 'state_changed';
  state: Record<string, unknown>;
  changedKeys: string[];
}

export interface PendingItemRegisteredEvent extends HarnessEventBase {
  type: 'pending_item_registered';
  item: HarnessPendingItemRecord;
}

export interface SubagentStartEvent extends HarnessEventBase {
  type: 'subagent_start';
  subagentSessionId: string;
  payload: {
    agentType: string;
    parentSessionId: string;
    depth: number;
  };
}

export interface CustomEvent extends HarnessEventBase {
  type: string;
  payload?: JsonSerializable;
}

export type HarnessEvent =
  | SessionCreatedEvent
  | ModeChangedEvent
  | ModelChangedEvent
  | ThreadClonedEvent
  | StateChangedEvent
  | PendingItemRegisteredEvent
  | SubagentStartEvent
  | CustomEvent;
export type HarnessEventListener = (event: HarnessEvent) => void | Promise<void>;
export type HarnessEventUnsubscribe = () => void;

export const HARNESS_EVENT_ID_PREFIX = 'harness-v1';

export interface ParsedHarnessEventId {
  epoch: string;
  sequence: number;
}

export class HarnessValidationError extends Error {
  constructor(
    readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'HarnessValidationError';
  }
}

export class HarnessEventSerializationError extends HarnessValidationError {
  constructor(
    readonly eventType: string,
    readonly reason: EventSerializationReason,
    readonly sessionId?: string,
  ) {
    super('event.payload', `custom event "${eventType}" payload is not JSON-serializable: ${reason}`);
    this.name = 'HarnessEventSerializationError';
  }
}

export type EventSerializationReason =
  | 'undefined'
  | 'function'
  | 'symbol'
  | 'bigint'
  | 'date'
  | 'map'
  | 'set'
  | 'typed-array'
  | 'non-plain-object'
  | 'cycle';

type JsonPrimitive = string | number | boolean | null;
type JsonSerializable = JsonPrimitive | JsonSerializable[] | { [key: string]: JsonSerializable };

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
export type EmitInput = DistributiveOmit<HarnessEvent, 'id' | 'timestamp' | 'sessionId'>;

export interface EmitterScope {
  sessionId?: string;
}

export function formatHarnessEventId(epoch: string, sequence: number): string {
  if (epoch.length === 0 || epoch.includes(':')) {
    throw new HarnessValidationError('eventId.epoch', 'epoch must be non-empty and must not contain ":"');
  }
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new HarnessValidationError('eventId.sequence', 'sequence must be a non-negative safe integer');
  }
  return `${HARNESS_EVENT_ID_PREFIX}:${epoch}:${sequence}`;
}

export function parseHarnessEventId(eventId: string): ParsedHarnessEventId {
  const parts = eventId.split(':');
  if (parts.length !== 3 || parts[0] !== HARNESS_EVENT_ID_PREFIX || parts[1] === '' || parts[2] === '') {
    throw new HarnessValidationError('lastEventId', 'expected event id grammar harness-v1:<epoch>:<seq>');
  }

  const sequenceText = parts[2]!;
  if (!/^(0|[1-9][0-9]*)$/.test(sequenceText)) {
    throw new HarnessValidationError('lastEventId', 'event id sequence must be an unsigned decimal integer');
  }

  const sequence = Number(sequenceText);
  if (!Number.isSafeInteger(sequence)) {
    throw new HarnessValidationError('lastEventId', 'event id sequence must be within JavaScript safe integer range');
  }

  return { epoch: parts[1]!, sequence };
}

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

export function assertCustomEventType(eventType: string): void {
  if (RESERVED_EVENT_TYPES.has(eventType) || RESERVED_EVENT_PREFIXES.some(prefix => eventType.startsWith(prefix))) {
    throw new HarnessValidationError('event.type', `"${eventType}" is reserved by the harness`);
  }
  if (!eventType.includes('.')) {
    throw new HarnessValidationError('event.type', 'custom event types must be namespaced with a dot');
  }
}

export function assertJsonSerializable(eventType: string, sessionId: string | undefined, value: unknown): void {
  visitJsonValue(eventType, sessionId, value, new WeakSet<object>());
}

export class EventEmitter {
  private readonly listeners: HarnessEventListener[] = [];
  private epoch?: string;
  private seq: number;
  private readonly scope: EmitterScope;
  private readonly onEvent?: HarnessEventListener;

  constructor(
    scope: EmitterScope = {},
    opts: { onEvent?: HarnessEventListener; epoch?: string; nextSequence?: number } = {},
  ) {
    this.scope = scope;
    this.onEvent = opts.onEvent;
    this.epoch = opts.epoch;
    this.seq = opts.nextSequence ?? 0;
    formatHarnessEventId(this.epoch ?? 'pending-epoch', this.seq);
  }

  scoped(scope: EmitterScope): EventEmitter {
    return new EventEmitter(
      { ...this.scope, ...scope },
      {
        onEvent: event => this.forward(event),
      },
    );
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
    this.validateCustomEvent(event, sessionId);
    const stamped = {
      ...event,
      id: formatHarnessEventId(this.epochId, this.seq++),
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
    this.epoch ??= randomUUID();
    return this.epoch;
  }

  private validateCustomEvent(event: EmitInput, sessionId: string | undefined): void {
    const eventType = (event as { type?: unknown }).type;
    if (typeof eventType !== 'string' || RESERVED_EVENT_TYPES.has(eventType)) return;

    assertCustomEventType(eventType);
    if (Object.prototype.hasOwnProperty.call(event, 'payload')) {
      assertJsonSerializable(eventType, sessionId, (event as { payload?: unknown }).payload);
    }
  }

  private dispatch(event: HarnessEvent): void {
    if (this.onEvent) {
      try {
        const result = this.onEvent(event);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(err => console.error('[harness/v1] event persistence rejected:', err));
        }
      } catch (err) {
        console.error('[harness/v1] event persistence threw:', err);
      }
    }

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

const RESERVED_EVENT_TYPES = new Set([
  'session_created',
  'mode_changed',
  'model_changed',
  'thread_cloned',
  'state_changed',
  'pending_item_registered',
  'subagent_start',
]);

const RESERVED_EVENT_PREFIXES = ['session_', 'thread_'];

function visitJsonValue(eventType: string, sessionId: string | undefined, value: unknown, seen: WeakSet<object>): void {
  if (value === undefined) throwSerialization(eventType, sessionId, 'undefined');
  if (typeof value === 'function') throwSerialization(eventType, sessionId, 'function');
  if (typeof value === 'symbol') throwSerialization(eventType, sessionId, 'symbol');
  if (typeof value === 'bigint') throwSerialization(eventType, sessionId, 'bigint');
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return;
  if (value instanceof Date) throwSerialization(eventType, sessionId, 'date');
  if (value instanceof Map) throwSerialization(eventType, sessionId, 'map');
  if (value instanceof Set) throwSerialization(eventType, sessionId, 'set');
  if (ArrayBuffer.isView(value)) throwSerialization(eventType, sessionId, 'typed-array');
  if (typeof value !== 'object') return;

  if (seen.has(value)) throwSerialization(eventType, sessionId, 'cycle');
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) visitJsonValue(eventType, sessionId, item, seen);
    seen.delete(value);
    return;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throwSerialization(eventType, sessionId, 'non-plain-object');
  }

  for (const item of Object.values(value)) {
    visitJsonValue(eventType, sessionId, item, seen);
  }
  seen.delete(value);
}

function throwSerialization(eventType: string, sessionId: string | undefined, reason: EventSerializationReason): never {
  throw new HarnessEventSerializationError(eventType, reason, sessionId);
}
