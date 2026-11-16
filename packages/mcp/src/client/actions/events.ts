import { MastraError } from '@mastra/core/error';
import type { IMastraLogger } from '@mastra/core/logger';
import { ProtocolError } from '@modelcontextprotocol/client';
import { EVENTS_ERROR_CODES } from '../../shared/events';
import type { EventDescriptor } from '../../shared/events';
import type { InternalMastraMCPClient } from '../client';
import { eventsError } from '../events/errors';
import { selectDeliveryMode } from '../events/mode';
import type { DeliveryDriver } from '../events/mode';
import { pollDriver } from '../events/poll-driver';
import { pushDriver } from '../events/push-driver';
import type { MCPEventDeliveryMode, MCPEventSubscribeOptions, MCPEventSubscription } from '../events/types';
import { webhookDriver } from '../events/webhook-driver';

const DRIVERS = { webhook: webhookDriver, push: pushDriver, poll: pollDriver } satisfies Record<
  MCPEventDeliveryMode,
  DeliveryDriver
>;

/** Upper bound on `events/list` pages followed, so a server cannot page a client forever. */
const MAX_LIST_PAGES = 100;

/** Webhook rejections after which a default subscription uses the next delivery mode. */
const WEBHOOK_FALLBACK_CODES: readonly number[] = [
  EVENTS_ERROR_CODES.Forbidden,
  EVENTS_ERROR_CODES.Unsupported,
  EVENTS_ERROR_CODES.ResourceExhausted,
];

/** The JSON-RPC error code a subscription start was rejected with, if any. */
function rejectionCode(error: unknown): number | undefined {
  if (error instanceof ProtocolError) return error.code;
  if (error instanceof MastraError) return rejectionCode(error.cause);
  return undefined;
}

interface EventClientActionsConfig {
  client: InternalMastraMCPClient;
  logger: IMastraLogger;
}

/**
 * Client-side actions for the MCP Events extension (SEP-3415): discover event types and
 * subscribe to their occurrences.
 *
 * @experimental SEP-3415 is a draft; this API may change.
 */
export class EventClientActions {
  private readonly client: InternalMastraMCPClient;
  private readonly logger: IMastraLogger;
  private descriptors?: Promise<EventDescriptor[]>;

  /**
   * @internal
   */
  constructor({ client, logger }: EventClientActionsConfig) {
    this.client = client;
    this.logger = logger;
  }

  /**
   * Lists the event types the server offers, following pagination.
   *
   * Changes to the list are not announced yet (`notifications/events/list_changed` needs
   * `subscriptions/listen` support that `@modelcontextprotocol/*` 2.2.0 lacks); call `list()`
   * again to pick up new event types.
   *
   * @throws {MastraError} `MCP_EVENTS_NOT_SUPPORTED` if the server does not advertise the events extension.
   *
   * @experimental SEP-3415 is a draft; this API may change.
   */
  public async list(): Promise<EventDescriptor[]> {
    this.assertSupported();
    const descriptors = this.fetchDescriptors();
    this.descriptors = descriptors;
    descriptors.catch(() => {
      if (this.descriptors === descriptors) this.descriptors = undefined;
    });
    return descriptors;
  }

  /**
   * Subscribes to an event type. Resolves once the server has accepted the subscription, so
   * invalid arguments or unknown events reject here.
   *
   * @param name - Event name from {@link list}
   * @param args - Subscription arguments, validated by the server against the event's `inputSchema`
   * @param options - Delivery, resume and retry settings
   *
   * @example
   * ```typescript
   * const sub = await client.events.subscribe('github.push', { repo: 'mastra-ai/mastra' });
   * for await (const event of sub) {
   *   console.log(event.eventId, event.data);
   *   await saveCursor(sub.cursor);
   * }
   * ```
   *
   * @experimental SEP-3415 is a draft; this API may change.
   */
  public async subscribe(
    name: string,
    args?: Record<string, unknown>,
    options?: MCPEventSubscribeOptions,
  ): Promise<MCPEventSubscription> {
    this.assertSupported();
    const descriptor = await this.findDescriptor(name);
    const details = { serverName: this.client.name, eventName: name };
    const webhook = this.client.webhook !== undefined;
    const mode = selectDeliveryMode(descriptor.delivery, options?.delivery, details, { webhook });
    this.logger.debug(`[${this.client.name}] Subscribing to event '${name}' via ${mode}`);
    const start = (selected: MCPEventDeliveryMode, notice?: MastraError) =>
      this.client.startEventSubscription({ name, arguments: args, driver: DRIVERS[selected], options, notice });
    if (mode !== 'webhook' || options?.delivery) return start(mode);

    try {
      return await start(mode);
    } catch (error) {
      // Webhook needs an authenticated HTTP connection (Forbidden or Unsupported without one) and
      // the server caps webhook subscriptions (ResourceExhausted). A default subscription falls back
      // to the next mode instead of failing.
      const code = rejectionCode(error);
      if (code === undefined || !WEBHOOK_FALLBACK_CODES.includes(code)) throw error;
      const fallback = selectDeliveryMode(descriptor.delivery, undefined, details);
      this.logger.debug(`[${this.client.name}] Webhook subscribe to '${name}' rejected (${code}); using ${fallback}`);
      return start(
        fallback,
        eventsError(
          'MCP_EVENTS_WEBHOOK_UNAVAILABLE',
          `Server '${this.client.name}' rejected webhook delivery for '${name}' (code ${code}); using ${fallback} delivery`,
          { ...details, code, fallback },
          error,
        ),
      );
    }
  }

  /**
   * Drops the cached event descriptors.
   *
   * @internal
   */
  public invalidate(): void {
    this.descriptors = undefined;
  }

  private assertSupported(): void {
    if (this.client.getEventsCapability()) return;
    throw eventsError(
      'MCP_EVENTS_NOT_SUPPORTED',
      `MCP server '${this.client.name}' does not support events (no 'io.modelcontextprotocol/events' extension)`,
      { serverName: this.client.name },
    );
  }

  private async findDescriptor(name: string): Promise<EventDescriptor> {
    const cached = this.descriptors ? await this.descriptors.catch(() => undefined) : undefined;
    const descriptor =
      cached?.find(entry => entry.name === name) ?? (await this.list()).find(entry => entry.name === name);
    if (descriptor) return descriptor;
    throw eventsError(
      'MCP_EVENTS_UNKNOWN_EVENT',
      `MCP server '${this.client.name}' does not offer an event named '${name}'`,
      { serverName: this.client.name, eventName: name },
    );
  }

  private async fetchDescriptors(): Promise<EventDescriptor[]> {
    const events: EventDescriptor[] = [];
    let cursor: string | undefined;
    let pages = 0;
    try {
      do {
        if (++pages > MAX_LIST_PAGES) {
          throw new Error(`events/list returned more than ${MAX_LIST_PAGES} pages`);
        }
        const page = await this.client.listEvents(cursor);
        events.push(...page.events);
        cursor = page.nextCursor;
      } while (cursor);
    } catch (error) {
      throw eventsError(
        'MCP_EVENTS_LIST_FAILED',
        `Failed to list events from MCP server '${this.client.name}': ${error instanceof Error ? error.message : String(error)}`,
        { serverName: this.client.name },
        error,
      );
    }
    return events;
  }
}
