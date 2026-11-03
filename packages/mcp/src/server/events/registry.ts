import { randomUUID } from 'node:crypto';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { toStandardSchema } from '@mastra/core/schema';
import type { StandardSchemaWithJSON } from '@mastra/core/schema';
import { ProtocolError } from '@modelcontextprotocol/server';

import { EVENTS_ERROR_CODES } from '../../shared/events';
import type { EventDeliveryMode, EventDescriptor, EventOccurrence } from '../../shared/events';
import { EventRingBuffer } from './ring-buffer';
import type { BufferedEvent } from './ring-buffer';
import type { EventStream } from './stream';
import type { MCPServerEmitOptions, MCPServerEventData, MCPServerEventDefinition } from './types';

const DEFAULT_BUFFER_SIZE = 1000;

export type EventListener = (entry: BufferedEvent) => void;

/** One configured event type. */
export interface RegisteredEvent {
  name: string;
  definition: MCPServerEventDefinition;
  delivery: EventDeliveryMode[];
  inputSchema?: StandardSchemaWithJSON;
  payloadSchema?: StandardSchemaWithJSON;
  /** Present when the type has no `poll` source, i.e. when it accepts `emit()`. */
  buffer?: EventRingBuffer;
  listeners: Set<EventListener>;
}

/**
 * Delivery modes advertised for a definition. They are fixed at construction because clients
 * only learn them from `events/list` (no `listChanged` yet). Without a `poll` source the type
 * is fed by `emit()` and served over push and poll; with one it is served over poll only. An
 * explicit `delivery` only narrows that set. `extraModes` lets other delivery mechanisms
 * (webhooks) add themselves.
 */
export function deriveDelivery(
  name: string,
  definition: Pick<MCPServerEventDefinition, 'poll' | 'delivery'>,
  extraModes: EventDeliveryMode[] = [],
): EventDeliveryMode[] {
  const servable: EventDeliveryMode[] = definition.poll ? ['poll'] : ['push', 'poll'];
  servable.push(...extraModes);
  const requested = definition.delivery ?? servable;
  const delivery = servable.filter(mode => requested.includes(mode));
  if (delivery.length === 0) {
    throw new MastraError({
      id: 'MCP_SERVER_EVENT_NO_DELIVERY_MODE',
      domain: ErrorDomain.MCP,
      category: ErrorCategory.USER,
      text: `Event "${name}" has no delivery mode this server can serve (requested: ${requested.join(', ')})`,
    });
  }
  return delivery;
}

/** Event types, their buffers and live subscriptions. Shared by every protocol instance of one `MCPServer`. */
export class ServerEventRegistry {
  readonly bootId = randomUUID();
  readonly openStreams = new Set<EventStream>();
  private readonly events = new Map<string, RegisteredEvent>();

  /** `webhook`: the server serves webhook delivery, which emit-fed types (no `poll` source) then advertise. */
  constructor(definitions: Record<string, MCPServerEventDefinition> | undefined, options: { webhook?: boolean } = {}) {
    for (const [name, definition] of Object.entries(definitions ?? {})) {
      this.events.set(name, {
        name,
        definition,
        delivery: deriveDelivery(name, definition, options.webhook && !definition.poll ? ['webhook'] : []),
        inputSchema: definition.inputSchema ? toStandardSchema(definition.inputSchema) : undefined,
        payloadSchema: definition.payloadSchema ? toStandardSchema(definition.payloadSchema) : undefined,
        buffer: !definition.poll
          ? new EventRingBuffer(`${this.bootId}/${name}`, definition.bufferSize ?? DEFAULT_BUFFER_SIZE)
          : undefined,
        listeners: new Set(),
      });
    }
  }

  get size(): number {
    return this.events.size;
  }

  list(): RegisteredEvent[] {
    return [...this.events.values()];
  }

  /**
   * The event type a poll or stream request names, if it supports `mode`.
   * @throws ProtocolError -32023 for an unknown name, -32026 for an unsupported mode.
   */
  resolve(name: string, mode: EventDeliveryMode): RegisteredEvent {
    const event = this.events.get(name);
    if (!event) {
      throw new ProtocolError(EVENTS_ERROR_CODES.NotFound, `Event not found: ${name}`, { kind: 'event', name });
    }
    if (!event.delivery.includes(mode)) {
      throw new ProtocolError(
        EVENTS_ERROR_CODES.Unsupported,
        `Delivery mode "${mode}" is not supported by event "${name}"`,
        { feature: 'deliveryMode', mode },
      );
    }
    return event;
  }

  /**
   * Validates subscription arguments against the type's `inputSchema`.
   * @throws ProtocolError -32602 when they do not match.
   */
  async validateArguments(event: RegisteredEvent, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!event.inputSchema) return args;
    const result = await event.inputSchema['~standard'].validate(args);
    if (result.issues) {
      const issues = result.issues.map(issue => ({
        message: issue.message,
        path: issue.path?.map(segment => String(typeof segment === 'object' ? segment.key : segment)),
      }));
      throw new ProtocolError(
        EVENTS_ERROR_CODES.InvalidParams,
        `Invalid arguments for event "${event.name}": ${issues.map(issue => issue.message).join('; ')}`,
        { issues },
      );
    }
    return result.value as Record<string, unknown>;
  }

  /** Records an occurrence and hands it to every live subscription of the type. */
  async emit(name: string, data: MCPServerEventData, options: MCPServerEmitOptions = {}): Promise<EventOccurrence> {
    const event = this.events.get(name);
    if (!event) {
      throw new MastraError({
        id: 'MCP_SERVER_UNKNOWN_EVENT',
        domain: ErrorDomain.MCP,
        category: ErrorCategory.USER,
        text: `Cannot emit unknown event "${name}"`,
      });
    }
    if (!event.buffer) {
      throw new MastraError({
        id: 'MCP_SERVER_EVENT_NOT_EMITTABLE',
        domain: ErrorDomain.MCP,
        category: ErrorCategory.USER,
        text: `Cannot emit event "${name}": it has a poll source, so it is served by its poll function only and cannot be pushed`,
      });
    }
    let payload = data;
    if (event.payloadSchema) {
      const result = await event.payloadSchema['~standard'].validate(data);
      if (result.issues) {
        throw new MastraError({
          id: 'MCP_SERVER_EVENT_INVALID_PAYLOAD',
          domain: ErrorDomain.MCP,
          category: ErrorCategory.USER,
          text: `Invalid payload for event "${name}": ${result.issues.map(issue => issue.message).join('; ')}`,
        });
      }
      payload = result.value as MCPServerEventData;
    }
    const entry = event.buffer.push({
      eventId: options.eventId ?? randomUUID(),
      name,
      timestamp: toTimestamp(options.timestamp),
      data: payload,
    });
    for (const listener of event.listeners) listener(entry);
    return { ...entry.occurrence, cursor: entry.cursor };
  }

  /** Registers a live listener for a type's emitted events. Returns the unsubscribe function. */
  subscribe(event: RegisteredEvent, listener: EventListener): () => void {
    event.listeners.add(listener);
    return () => event.listeners.delete(listener);
  }

  listenerCount(): number {
    let count = 0;
    for (const event of this.events.values()) count += event.listeners.size;
    return count;
  }

  closeStreams(): void {
    for (const stream of this.openStreams) stream.close();
  }
}

export function toTimestamp(value: string | Date | undefined): string {
  if (value === undefined) return new Date().toISOString();
  return typeof value === 'string' ? value : value.toISOString();
}

export function toDescriptor(
  event: RegisteredEvent,
  convert: (schema: unknown, options: { io: 'input' | 'output' }) => Record<string, unknown> | undefined,
): EventDescriptor {
  const descriptor: EventDescriptor = { name: event.name, delivery: event.delivery };
  if (event.definition.description) descriptor.description = event.definition.description;
  const inputSchema = convert(event.inputSchema, { io: 'input' });
  if (inputSchema) descriptor.inputSchema = inputSchema;
  const payloadSchema = convert(event.payloadSchema, { io: 'output' });
  if (payloadSchema) descriptor.payloadSchema = payloadSchema;
  return descriptor;
}
