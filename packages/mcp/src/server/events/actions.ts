import type { EventDescriptor, EventOccurrence } from '../../shared/events';
import type { ServerEventRegistry } from './registry';
import type { MCPServerEmitOptions, MCPServerEventData } from './types';

/**
 * `server.events`: publishes occurrences of the event types configured in `MCPServer`'s `events`.
 *
 * Emitted events are delivered to this process's open `events/stream` subscriptions, POSTed to
 * its webhook subscriptions (when `eventsOptions.webhook` is set), and kept in the type's
 * in-memory ring buffer for `events/poll`. They do not reach other server processes.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export class ServerEventActions {
  constructor(
    private readonly registry: ServerEventRegistry,
    private readonly describe: () => EventDescriptor[],
  ) {}

  /**
   * Records an occurrence of `name` and delivers it to every matching push and webhook subscription.
   * `data` is validated against the type's `payloadSchema` when one is set.
   *
   * @throws MastraError `MCP_SERVER_UNKNOWN_EVENT` for an unconfigured name,
   * `MCP_SERVER_EVENT_INVALID_PAYLOAD` when `data` fails `payloadSchema`, and
   * `MCP_SERVER_EVENT_NOT_EMITTABLE` for a type with a `poll` source, which can't be pushed.
   *
   * @experimental SEP-3415 is a draft; this API may change.
   */
  emit(name: string, data: MCPServerEventData, options?: MCPServerEmitOptions): Promise<EventOccurrence> {
    return this.registry.emit(name, data, options);
  }

  /**
   * The descriptors `events/list` returns, in definition order.
   *
   * @experimental SEP-3415 is a draft; this API may change.
   */
  list(): EventDescriptor[] {
    return this.describe();
  }
}
