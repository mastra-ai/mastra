import { generateWebhookSecret } from '../../shared/events';
import type { SubscribeEventsResult } from '../../shared/events';
import { eventsError } from './errors';
import type { DeliveryContext, DeliveryDriver } from './mode';
import type { EventsPort, EventsWebhookSetup } from './types';
import type { WebhookBody } from './webhook-receiver';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_MARGIN_MS = 60_000;
const MIN_REFRESH_DELAY_MS = 1000;

/** Waits `ms`, resolving early on abort or when `wake` is called. */
function pause(ms: number, signal: AbortSignal, onWake: (wake: () => void) => void): Promise<void> {
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
    onWake(done);
  });
}

/** JSON with sorted object keys, so equal arguments give equal keys. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

interface Member {
  context: DeliveryContext;
  fail: (error: unknown) => void;
}

/**
 * One server-side webhook subscription, shared by every local subscription with the same event
 * name and arguments on one server connection. The server keys webhook subscriptions by
 * `(principal, url, name, arguments)`, so separate `events/subscribe` calls for the same key would
 * address the same subscription; sharing it keeps each local subscription fed and unsubscribes
 * only when the last one is cancelled.
 */
class WebhookShare {
  private readonly members = new Set<Member>();
  private readonly controller = new AbortController();
  private readonly secret: string;
  private readonly started: Promise<void>;
  private resolveStarted!: () => void;
  private rejectStarted!: (error: unknown) => void;
  private route?: { id: string; unregister: () => void };
  private cursor: string | null;
  private last?: SubscribeEventsResult;
  private wake?: () => void;
  private closed = false;

  constructor(
    private readonly port: EventsPort,
    private readonly setup: EventsWebhookSetup,
    private readonly name: string,
    private readonly args: Record<string, unknown> | undefined,
    private readonly maxAgeMs: number | undefined,
    cursor: string | null,
    private readonly onClosed: () => void,
  ) {
    this.secret = setup.options.secret ?? generateWebhookSecret();
    this.cursor = cursor;
    this.started = new Promise((resolve, reject) => {
      this.resolveStarted = resolve;
      this.rejectStarted = reject;
    });
    this.started.catch(() => {});
    void this.run();
  }

  /** Adds a local subscription. Resolves once it has been confirmed by the server. */
  join(member: Member): Promise<void> {
    this.members.add(member);
    // A late joiner starts from the shared position; the server cannot replay for one member only.
    if (this.last) this.apply(member, { ...this.last, cursor: this.cursor, truncated: false });
    return this.started;
  }

  /** Removes a cancelled local subscription; the last one out unsubscribes. */
  async leave(member: Member): Promise<void> {
    if (!this.members.delete(member) || this.members.size > 0 || this.closed) return;
    const route = this.route;
    this.close();
    if (!route) return;
    await this.port
      .unsubscribe({ name: this.name, ...(this.args ? { arguments: this.args } : {}), delivery: { url: this.setup.options.url } })
      .catch(error =>
        this.port.log('warning', `Webhook unsubscribe for '${this.name}' failed`, {
          eventName: this.name,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
  }

  private close(): void {
    this.closed = true;
    this.onClosed();
    this.controller.abort();
    this.wake?.();
    this.route?.unregister();
    this.route = undefined;
  }

  /** Ends the shared subscription and fails every member, which then retry or end on their own. */
  private destroy(error: unknown): void {
    if (this.closed) return;
    this.close();
    this.rejectStarted(error);
    const members = [...this.members];
    this.members.clear();
    for (const member of members) member.fail(error);
  }

  private apply(member: Member, result: SubscribeEventsResult): void {
    const { context } = member;
    context.setPosition(result.cursor, result.truncated ?? false);
    context.established();
    context.setDeliveryStatus(result.deliveryStatus);
    const status = result.deliveryStatus;
    if (status && (!status.active || status.lastError)) {
      context.reportError(
        eventsError(
          'MCP_EVENTS_WEBHOOK_DELIVERY_FAILING',
          `Server reports failing webhook delivery for '${this.name}': ${status.lastError ?? 'suspended'}`,
          { eventName: this.name, active: status.active, lastError: status.lastError ?? null },
        ),
      );
    }
  }

  private readonly onBody = (body: WebhookBody): void => {
    if (body.kind === 'event') {
      const { cursor, ...occurrence } = body.event;
      if (cursor !== undefined) this.cursor = cursor;
      for (const { context } of this.members) {
        context.deliver(occurrence);
        if (cursor !== undefined) context.setPosition(cursor);
      }
      return;
    }
    if (body.control.type === 'gap') {
      this.cursor = body.control.cursor;
      for (const { context } of this.members) context.setPosition(body.control.cursor, true);
      return;
    }
    this.destroy(
      eventsError(
        'MCP_EVENTS_SUBSCRIPTION_TERMINATED',
        `Server terminated the '${this.name}' webhook subscription: ${body.control.error.message}`,
        { eventName: this.name, code: body.control.error.code },
      ),
    );
  };

  private async subscribe(): Promise<SubscribeEventsResult> {
    const { options, receiver } = this.setup;
    // The handshake arrives before the server tells us the id, so it is matched by secret.
    const release = receiver.expect(this.secret);
    try {
      return await this.port.subscribe(
        {
          name: this.name,
          ...(this.args ? { arguments: this.args } : {}),
          delivery: { mode: 'webhook', url: options.url, secret: this.secret },
          cursor: this.cursor,
          ...(this.maxAgeMs !== undefined ? { maxAgeMs: this.maxAgeMs } : {}),
          ...(options.ttlMs !== undefined ? { ttlMs: options.ttlMs } : {}),
        },
        this.controller.signal,
      );
    } finally {
      release();
    }
  }

  private async run(): Promise<void> {
    const { signal } = this.controller;
    try {
      while (!this.closed) {
        const requestedAt = Date.now();
        const result = await this.subscribe();
        if (this.closed) return;
        const expiresAt = result.refreshBefore === null ? null : Date.parse(result.refreshBefore);
        if (expiresAt !== null && !Number.isFinite(expiresAt)) {
          throw eventsError(
            'MCP_EVENTS_SUBSCRIPTION_FAILED',
            `Server returned an invalid refreshBefore for the '${this.name}' webhook subscription`,
            { eventName: this.name },
          );
        }
        if (this.route?.id !== result.id) {
          this.route?.unregister();
          this.route = {
            id: result.id,
            unregister: this.setup.receiver.register(result.id, { secret: this.secret, onBody: this.onBody }),
          };
        }
        this.cursor = result.cursor;
        this.last = result;
        for (const member of [...this.members]) this.apply(member, result);
        this.resolveStarted();

        let delay = DAY_MS;
        if (expiresAt !== null) {
          const grant = expiresAt - requestedAt;
          const margin = this.setup.options.refreshMarginMs ?? Math.min(MAX_MARGIN_MS, grant * 0.2);
          delay = Math.max(grant - margin - (Date.now() - requestedAt), MIN_REFRESH_DELAY_MS);
        }
        await pause(Math.min(delay, DAY_MS), signal, done => (this.wake = done));
        this.wake = undefined;
      }
    } catch (error) {
      this.destroy(error);
    }
  }
}

const sharesByPort = new WeakMap<EventsPort, Map<string, WebhookShare>>();

/**
 * Webhook delivery: registers the client's webhook URL with `events/subscribe`, routes verified
 * deliveries from the shared receiver into the subscription, and refreshes before the server's
 * `refreshBefore`. Local subscriptions with the same event name and arguments share one server
 * subscription; cancelling the last one unregisters the route and sends a best-effort
 * `events/unsubscribe`.
 */
export const webhookDriver: DeliveryDriver = {
  mode: 'webhook',
  async session(context: DeliveryContext): Promise<void> {
    const { port, signal } = context;
    const setup = port.webhook();
    if (!setup) {
      throw eventsError('MCP_EVENTS_WEBHOOK_NOT_CONFIGURED', 'Webhook delivery needs the client `webhook` option');
    }
    if (signal.aborted) return;

    let shares = sharesByPort.get(port);
    if (!shares) sharesByPort.set(port, (shares = new Map()));
    const registry = shares;
    const key = canonical([context.name, context.arguments ?? null]);
    let share = registry.get(key);
    if (!share) {
      const created: WebhookShare = new WebhookShare(
        port,
        setup,
        context.name,
        context.arguments,
        context.options.maxAgeMs,
        context.cursor,
        () => {
          if (registry.get(key) === created) registry.delete(key);
        },
      );
      registry.set(key, created);
      share = created;
    }

    const member: Member = { context, fail: () => {} };
    try {
      await new Promise<void>((resolve, reject) => {
        member.fail = reject;
        signal.addEventListener('abort', () => resolve(), { once: true });
        share.join(member).catch(reject);
      });
    } finally {
      // A failed share has already dropped its members, so this only acts on cancellation.
      await share.leave(member);
    }
  },
};
