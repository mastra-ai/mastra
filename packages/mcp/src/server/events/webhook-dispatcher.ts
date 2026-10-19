import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IMastraLogger } from '@mastra/core/logger';
import { ProtocolError } from '@modelcontextprotocol/server';

import {
  EVENTS_ERROR_CODES,
  WEBHOOK_HEADERS,
  WebhookUrlError,
  resolveAndValidate,
  signWebhook,
} from '../../shared/events';
import type {
  ResolvedWebhookUrl,
  SubscribeEventsRequestParams,
  SubscribeEventsResult,
  WebhookDeliveryStatus,
  WebhookFailureReason,
} from '../../shared/events';
import { hashArguments } from '../request';
import type { RegisteredEvent, ServerEventRegistry } from './registry';
import type { BufferedEvent, StoredOccurrence } from './ring-buffer';
import type { MCPServerWebhookOptions } from './types';
import { InMemoryWebhookSubscriptionStore } from './webhook-store';
import type { WebhookSubscriptionRecord, WebhookSubscriptionStore } from './webhook-store';
import { nodeWebhookTransport, statusFailure } from './webhook-transport';
import type { WebhookTransport, WebhookTransportResult } from './webhook-transport';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const MAX_TIMER_MS = 0x7fffffff;

/** Settings with defaults applied. */
interface Settings {
  defaultTtlMs: number;
  minTtlMs: number;
  maxTtlMs: number;
  allowNoExpiry: boolean;
  verificationTtlMs: number;
  timeoutMs: number;
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  maxWindowMs: number;
  suspendWindowMs: number;
  suspendMinAttempts: number;
  suspendFailureRate: number;
  maxPending: number;
  secretGraceMs: number;
  maxSubscriptions: number;
  maxSubscriptionsPerPrincipal: number;
}

function resolveSettings(options: MCPServerWebhookOptions): Settings {
  return {
    defaultTtlMs: options.ttl?.defaultMs ?? 30 * MINUTE,
    minTtlMs: options.ttl?.minMs ?? MINUTE,
    maxTtlMs: options.ttl?.maxMs ?? 24 * HOUR,
    allowNoExpiry: options.allowNoExpiry ?? false,
    verificationTtlMs: options.verificationTtlMs ?? 24 * HOUR,
    timeoutMs: options.timeoutMs ?? 5000,
    maxAttempts: options.retry?.maxAttempts ?? 5,
    initialDelayMs: options.retry?.initialDelayMs ?? 1000,
    maxDelayMs: options.retry?.maxDelayMs ?? 5 * MINUTE,
    maxWindowMs: options.retry?.maxWindowMs ?? 15 * MINUTE,
    suspendWindowMs: options.suspend?.windowMs ?? HOUR,
    suspendMinAttempts: options.suspend?.minAttempts ?? 100,
    suspendFailureRate: options.suspend?.failureRate ?? 0.95,
    maxPending: options.maxPending ?? 1000,
    secretGraceMs: options.secretGraceMs ?? 5 * MINUTE,
    maxSubscriptions: options.maxSubscriptions ?? 1000,
    maxSubscriptionsPerPrincipal: options.maxSubscriptionsPerPrincipal ?? 100,
  };
}

/** One event awaiting acknowledgement by a subscription's endpoint. */
interface PendingDelivery {
  occurrence: StoredOccurrence;
  /** Watermark once this entry and every earlier one has settled; later filtered-out events extend it. */
  advanceTo: string;
  settled: boolean;
  inFlight: boolean;
  attempts: number;
  firstAttemptAt?: number;
  /** `DeliveryState.suspendedMs` when the first attempt was made, so suspended time is excluded from the retry window. */
  suspendedMsAtStart: number;
  timer?: ReturnType<typeof setTimeout>;
}

/** In-memory delivery bookkeeping for one live subscription. Lost on restart; a refresh rebuilds it. */
interface DeliveryState {
  record: WebhookSubscriptionRecord;
  event: RegisteredEvent;
  /** Buffer sequence up to which events are covered by the subscribe-time replay. */
  horizon: number;
  queue: PendingDelivery[];
  /** Position at or before which every event has been acknowledged or abandoned. */
  watermark: string;
  active: boolean;
  suspendedAt?: number;
  suspendedMs: number;
  samples: { at: number; ok: boolean }[];
  lastDeliveryAt: number | null;
  lastError: WebhookFailureReason | null;
  failedSince: number | null;
  timers: Set<ReturnType<typeof setTimeout>>;
  closed: boolean;
}

export interface WebhookDispatcherConfig {
  registry: ServerEventRegistry;
  options: MCPServerWebhookOptions;
  getLogger: () => IMastraLogger;
  /** Source of retry jitter; tests pin it. */
  random?: () => number;
}

/** `CallbackEndpointError` carrying only a failure category. */
function callbackEndpointError(reason: WebhookFailureReason): ProtocolError {
  return new ProtocolError(EVENTS_ERROR_CODES.CallbackEndpointError, 'Webhook callback endpoint check failed', {
    reason,
  });
}

/** Maps a callback URL policy failure to a JSON-RPC error without echoing resolver details. */
function urlPolicyError(error: unknown): ProtocolError {
  if (error instanceof WebhookUrlError && error.reason !== 'dns_failure') {
    return new ProtocolError(EVENTS_ERROR_CODES.InvalidParams, 'Webhook callback URL is not allowed', {
      reason: error.reason,
    });
  }
  return callbackEndpointError('connection_refused');
}

function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

function iso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

/**
 * Serves webhook delivery for one `MCPServer`: `events/subscribe` upserts, endpoint verification,
 * fan-out of emitted events, signed POSTs with retries, the safe-to-persist watermark, suspension
 * and control envelopes.
 *
 * Subscriptions live in the configured {@link WebhookSubscriptionStore}; delivery state is in
 * memory and only reaches this process's subscriptions.
 */
export class WebhookDispatcher {
  private readonly settings: Settings;
  private readonly store: WebhookSubscriptionStore;
  private readonly transport: WebhookTransport;
  private readonly states = new Map<string, DeliveryState>();
  private readonly verified = new Map<string, number>();
  private readonly fanOutChains = new Map<string, Promise<void>>();
  private readonly unsubscribers: (() => void)[] = [];
  private readonly random: () => number;
  private closed = false;

  constructor(private readonly config: WebhookDispatcherConfig) {
    this.settings = resolveSettings(config.options);
    this.store = config.options.store ?? new InMemoryWebhookSubscriptionStore();
    this.transport = config.options.transport ?? nodeWebhookTransport;
    this.random = config.random ?? Math.random;
    for (const event of config.registry.list()) {
      if (!event.delivery.includes('webhook')) continue;
      this.unsubscribers.push(config.registry.subscribe(event, entry => this.onEmit(event, entry)));
    }
  }

  /** Subscription id for a key: a truncated SHA-256 over the canonical key. A routing handle, not a capability. */
  static subscriptionId(key: { principal: string; url: string; name: string; arguments: Record<string, unknown> }) {
    return `sub_${hashArguments([key.principal, key.url, key.name, key.arguments]).slice(0, 24)}`;
  }

  /**
   * Creates or refreshes the subscription keyed by `(principal, url, name, args)`.
   * @throws ProtocolError `InvalidParams` for a disallowed callback URL, `CallbackEndpointError` when
   * the endpoint fails verification.
   */
  async subscribe(
    event: RegisteredEvent,
    args: Record<string, unknown>,
    params: SubscribeEventsRequestParams,
    principal: string,
  ): Promise<SubscribeEventsResult> {
    const url = params.delivery.url;
    const id = WebhookDispatcher.subscriptionId({ principal, url, name: event.name, arguments: args });
    if (!this.states.has(id)) this.assertCapacity(principal);
    const resolved = await this.resolveUrl(url);

    const grantMs = this.grantTtl(params.ttlMs);
    if (!this.isVerified(principal, url, resolved.url)) {
      await this.verify(id, params.delivery.secret, resolved);
      this.rememberVerified(`${principal}\n${url}`);
    }

    const now = Date.now();
    const existing = await this.store.get(id);
    const previousSecret =
      existing && existing.secret !== params.delivery.secret
        ? { secret: existing.secret, until: now + this.settings.secretGraceMs }
        : existing?.previousSecret && existing.previousSecret.until > now
          ? existing.previousSecret
          : undefined;
    const record: WebhookSubscriptionRecord = {
      id,
      principal,
      url,
      name: event.name,
      arguments: args,
      secret: params.delivery.secret,
      ...(previousSecret ? { previousSecret } : {}),
      expiresAt: grantMs === null ? null : now + grantMs,
      createdAt: existing?.createdAt ?? now,
    };
    if (this.closed) throw new ProtocolError(EVENTS_ERROR_CODES.Unsupported, 'Server is shutting down');

    // Delivery state is set up synchronously, before the store write, so an emit fanned out in
    // between is either covered by the replay below or arrives after `horizon`.
    const refreshBefore = iso(record.expiresAt);
    const live = this.states.get(id);
    if (live) {
      // A live subscription keeps delivering from its own position; the supplied cursor is at or
      // behind the in-flight position, so it is not replayed.
      const deliveryStatus = this.statusOf(live);
      live.record = record;
      this.scheduleExpiry(live);
      this.resume(live);
      await this.persist(record);
      return { id, refreshBefore, cursor: live.watermark, deliveryStatus };
    }

    const buffer = event.buffer!;
    const replay = buffer.read(params.cursor, {
      maxEvents: Number.POSITIVE_INFINITY,
      maxAgeMs: params.maxAgeMs,
      match: data => this.matches(event, args, data),
    });
    const state = this.createState(record, event, params.cursor == null ? buffer.head : replay.from, buffer.lastSeq);
    for (const { cursor, ...occurrence } of replay.events) this.enqueue(state, occurrence, cursor ?? replay.cursor);
    this.skip(state, replay.cursor);
    await this.persist(record);
    return {
      id,
      refreshBefore,
      cursor: state.watermark,
      ...(replay.truncated ? { truncated: true } : {}),
    };
  }

  private assertCapacity(principal: string): void {
    const { maxSubscriptions, maxSubscriptionsPerPrincipal } = this.settings;
    let held = 0;
    for (const state of this.states.values()) if (state.record.principal === principal) held++;
    if (this.states.size >= maxSubscriptions || held >= maxSubscriptionsPerPrincipal) {
      throw new ProtocolError(EVENTS_ERROR_CODES.ResourceExhausted, 'Too many webhook subscriptions');
    }
  }

  /** Records a verified `(principal, url)` pair, dropping expired pairs and the oldest past a cap. */
  private rememberVerified(key: string): void {
    const now = Date.now();
    for (const [entry, until] of this.verified) if (until <= now) this.verified.delete(entry);
    this.verified.delete(key);
    this.verified.set(key, now + this.settings.verificationTtlMs);
    const limit = this.settings.maxSubscriptions * 2;
    for (const entry of this.verified.keys()) {
      if (this.verified.size <= limit) break;
      this.verified.delete(entry);
    }
  }

  private async persist(record: WebhookSubscriptionRecord): Promise<void> {
    try {
      await this.store.set(record);
    } catch (error) {
      this.dropState(record.id);
      throw error;
    }
  }

  /** Removes the subscription with this key, if any. Answers the same either way. */
  async unsubscribe(key: { principal: string; url: string; name: string; arguments: Record<string, unknown> }) {
    const id = WebhookDispatcher.subscriptionId(key);
    await this.store.delete(id);
    this.dropState(id);
  }

  /** Stops every timer and retry. */
  close(): void {
    this.closed = true;
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
    for (const id of [...this.states.keys()]) this.dropState(id);
  }

  private grantTtl(requested: number | null | undefined): number | null {
    const { defaultTtlMs, minTtlMs, maxTtlMs, allowNoExpiry } = this.settings;
    if (requested === undefined) return defaultTtlMs;
    if (requested === null) return allowNoExpiry ? null : maxTtlMs;
    return Math.min(Math.max(requested, minTtlMs), maxTtlMs);
  }

  private async resolveUrl(url: string): Promise<ResolvedWebhookUrl> {
    try {
      return await resolveAndValidate(url, this.config.options.url);
    } catch (error) {
      throw urlPolicyError(error);
    }
  }

  private isVerified(principal: string, url: string, parsed: URL): boolean {
    if (this.config.options.allowedUrls?.(parsed)) return true;
    const until = this.verified.get(`${principal}\n${url}`);
    return until !== undefined && until > Date.now();
  }

  /** The challenge handshake: the endpoint must echo a fresh nonce from a `2xx` response. */
  private async verify(id: string, secret: string, resolved: ResolvedWebhookUrl): Promise<void> {
    const challenge = randomBytes(24).toString('base64url');
    const result = await this.post(resolved, {
      subscriptionId: id,
      webhookId: `msg_verification_${randomBytes(12).toString('hex')}`,
      secrets: [secret],
      body: JSON.stringify({ type: 'verification', challenge }),
    });
    if ('error' in result) throw callbackEndpointError(result.error);
    if (!isSuccess(result.status) || !echoes(result.body, challenge)) throw callbackEndpointError('challenge_failed');
  }

  private createState(
    record: WebhookSubscriptionRecord,
    event: RegisteredEvent,
    watermark: string,
    horizon: number,
  ): DeliveryState {
    const state: DeliveryState = {
      record,
      event,
      horizon,
      queue: [],
      watermark,
      active: true,
      suspendedMs: 0,
      samples: [],
      lastDeliveryAt: null,
      lastError: null,
      failedSince: null,
      timers: new Set(),
      closed: false,
    };
    this.states.set(record.id, state);
    this.scheduleExpiry(state);
    return state;
  }

  private onEmit(event: RegisteredEvent, entry: BufferedEvent): void {
    // Serialised per type so subscriptions see emitted events in order despite the async store.
    const previous = this.fanOutChains.get(event.name) ?? Promise.resolve();
    const next = previous
      .then(() => this.fanOut(event, entry))
      .catch(error => this.config.getLogger().error(`Webhook fan-out for "${event.name}" failed`, { error }));
    this.fanOutChains.set(event.name, next);
  }

  private async fanOut(event: RegisteredEvent, entry: BufferedEvent): Promise<void> {
    const records = await this.store.list(event.name);
    const now = Date.now();
    for (const record of records) {
      if (this.closed) return;
      if (record.expiresAt !== null && record.expiresAt <= now) {
        await this.expire(record.id);
        continue;
      }
      let state = this.states.get(record.id);
      if (!state) {
        // A stored subscription with no in-memory state (for example after a restart): deliver from here on.
        state = this.createState(record, event, event.buffer!.cursorFor(entry.seq - 1), entry.seq - 1);
      }
      if (entry.seq <= state.horizon) continue;
      if (this.matches(event, record.arguments, entry.occurrence.data))
        this.enqueue(state, entry.occurrence, entry.cursor);
      else this.skip(state, entry.cursor);
    }
  }

  private matches(event: RegisteredEvent, args: Record<string, unknown>, data: Record<string, unknown>): boolean {
    const { match } = event.definition;
    if (!match) return true;
    try {
      return match(args, data);
    } catch (error) {
      this.config.getLogger().error(`Event filter for "${event.name}" failed`, { error });
      return false;
    }
  }

  /** Advances past an event this subscription does not receive. */
  private skip(state: DeliveryState, cursor: string): void {
    const last = state.queue.at(-1);
    if (last) last.advanceTo = cursor;
    else state.watermark = cursor;
  }

  private enqueue(state: DeliveryState, occurrence: StoredOccurrence, cursor: string): void {
    if (state.queue.length >= this.settings.maxPending) this.overflow(state);
    const pending: PendingDelivery = {
      occurrence,
      advanceTo: cursor,
      settled: false,
      inFlight: false,
      attempts: 0,
      suspendedMsAtStart: state.suspendedMs,
    };
    state.queue.push(pending);
    void this.attempt(state, pending);
  }

  /** Drops every undelivered event and tells the endpoint where delivery resumes with a `gap`. */
  private overflow(state: DeliveryState): void {
    for (const pending of state.queue) {
      pending.settled = true;
      this.clearTimer(state, pending);
    }
    const last = state.queue.at(-1);
    if (last) state.watermark = last.advanceTo;
    state.queue = [];
    void this.sendControl(state, { type: 'gap', cursor: state.watermark }, 1);
  }

  private async attempt(state: DeliveryState, pending: PendingDelivery): Promise<void> {
    if (state.closed || !state.active || pending.settled || pending.inFlight) return;
    if (this.isExpired(state)) {
      await this.expire(state.record.id);
      return;
    }
    pending.timer = undefined;
    pending.inFlight = true;
    pending.attempts++;
    if (pending.firstAttemptAt === undefined) {
      pending.firstAttemptAt = Date.now();
      pending.suspendedMsAtStart = state.suspendedMs;
    }

    const result = await this.deliver(state, {
      webhookId: pending.occurrence.eventId,
      body: JSON.stringify({ ...pending.occurrence, cursor: state.watermark }),
    });
    pending.inFlight = false;
    if (state.closed || pending.settled) return;

    if (!('error' in result) && (isSuccess(result.status) || result.status === 410 || result.status === 413)) {
      if (isSuccess(result.status)) this.recordOutcome(state, null);
      this.settle(state, pending);
      return;
    }

    this.recordOutcome(state, 'error' in result ? result.error : statusFailure(result.status));
    const elapsed = Date.now() - pending.firstAttemptAt - (state.suspendedMs - pending.suspendedMsAtStart);
    if (pending.attempts >= this.settings.maxAttempts || elapsed >= this.settings.maxWindowMs) {
      this.settle(state, pending);
      return;
    }
    if (this.maybeSuspend(state)) return;
    this.scheduleRetry(state, pending);
  }

  private scheduleRetry(state: DeliveryState, pending: PendingDelivery): void {
    const ceiling = Math.min(this.settings.maxDelayMs, this.settings.initialDelayMs * 2 ** (pending.attempts - 1));
    const delay = ceiling / 2 + this.random() * (ceiling / 2);
    pending.timer = this.setTimer(state, () => void this.attempt(state, pending), delay);
  }

  private settle(state: DeliveryState, pending: PendingDelivery): void {
    pending.settled = true;
    this.clearTimer(state, pending);
    while (state.queue[0]?.settled) state.watermark = state.queue.shift()!.advanceTo;
  }

  private recordOutcome(state: DeliveryState, failure: WebhookFailureReason | null): void {
    const now = Date.now();
    state.samples.push({ at: now, ok: failure === null });
    const floor = now - this.settings.suspendWindowMs;
    while (state.samples.length > 0 && state.samples[0]!.at < floor) state.samples.shift();
    if (failure === null) {
      state.lastDeliveryAt = now;
      state.lastError = null;
      state.failedSince = null;
    } else {
      state.lastError = failure;
      state.failedSince ??= now;
    }
  }

  /** Suspends delivery once the failure rate over the window crosses the threshold. */
  private maybeSuspend(state: DeliveryState): boolean {
    const { suspendMinAttempts, suspendFailureRate, suspendWindowMs } = this.settings;
    if (state.samples.length < suspendMinAttempts) return false;
    const failures = state.samples.filter(sample => !sample.ok).length;
    if (failures / state.samples.length < suspendFailureRate) return false;

    state.active = false;
    state.suspendedAt = Date.now();
    for (const pending of state.queue) this.clearTimer(state, pending);
    this.config.getLogger().warn(`Suspended webhook delivery for subscription ${state.record.id}`, {
      lastError: state.lastError,
    });
    if (state.record.expiresAt === null) {
      // No TTL will collect it: drop it if the client does not refresh within another window.
      this.setTimer(state, () => void this.terminate(state), suspendWindowMs);
    }
    return true;
  }

  /** A refresh is the client's liveness signal: reactivate a suspended subscription and retry what is pending. */
  private resume(state: DeliveryState): void {
    if (state.active) return;
    state.active = true;
    state.suspendedMs += Date.now() - (state.suspendedAt ?? Date.now());
    state.suspendedAt = undefined;
    state.samples = [];
    for (const timer of state.timers) clearTimeout(timer);
    state.timers.clear();
    this.scheduleExpiry(state);
    for (const pending of state.queue) {
      pending.timer = undefined;
      if (!pending.settled) void this.attempt(state, pending);
    }
  }

  private async terminate(state: DeliveryState): Promise<void> {
    if (state.closed || state.active) return;
    await this.sendControl(
      state,
      {
        type: 'terminated',
        error: {
          code: EVENTS_ERROR_CODES.CallbackEndpointError,
          message: 'Webhook delivery failed repeatedly',
          data: { reason: state.lastError ?? 'connection_refused' },
        },
      },
      1,
    );
    await this.expire(state.record.id);
  }

  /** Sends a control envelope (`gap`, `terminated`), retrying with backoff up to `maxAttempts` attempts. */
  private async sendControl(state: DeliveryState, body: Record<string, unknown>, attempt: number): Promise<void> {
    if (state.closed) return;
    const result = await this.deliver(state, {
      webhookId: `msg_${String(body.type)}_${randomBytes(12).toString('hex')}`,
      body: JSON.stringify(body),
    });
    if (state.closed || (!('error' in result) && isSuccess(result.status))) return;
    if (attempt >= this.settings.maxAttempts || body.type === 'terminated') return;
    const ceiling = Math.min(this.settings.maxDelayMs, this.settings.initialDelayMs * 2 ** (attempt - 1));
    this.setTimer(state, () => void this.sendControl(state, body, attempt + 1), ceiling);
  }

  /** One signed POST to a subscription's endpoint, re-validating the URL so DNS cannot rebind it. */
  private async deliver(
    state: DeliveryState,
    message: { webhookId: string; body: string },
  ): Promise<WebhookTransportResult> {
    const { record } = state;
    let resolved: ResolvedWebhookUrl;
    try {
      resolved = await resolveAndValidate(record.url, this.config.options.url);
    } catch {
      return { error: 'connection_refused' };
    }
    const now = Date.now();
    const secrets = [record.secret];
    if (record.previousSecret && record.previousSecret.until > now) secrets.push(record.previousSecret.secret);
    return this.post(resolved, { subscriptionId: record.id, secrets, ...message });
  }

  private async post(
    resolved: ResolvedWebhookUrl,
    message: { subscriptionId: string; webhookId: string; secrets: string[]; body: string },
  ): Promise<WebhookTransportResult> {
    const timestamp = Math.floor(Date.now() / 1000);
    try {
      return await this.transport({
        url: resolved.url,
        address: resolved.address,
        family: resolved.family,
        timeoutMs: this.settings.timeoutMs,
        body: message.body,
        headers: {
          'content-type': 'application/json',
          [WEBHOOK_HEADERS.id]: message.webhookId,
          [WEBHOOK_HEADERS.timestamp]: String(timestamp),
          [WEBHOOK_HEADERS.signature]: signWebhook({
            secret: message.secrets,
            id: message.webhookId,
            timestamp,
            body: message.body,
          }),
          [WEBHOOK_HEADERS.subscriptionId]: message.subscriptionId,
        },
      });
    } catch (error) {
      this.config.getLogger().warn('Webhook transport failed', { error });
      return { error: 'connection_refused' };
    }
  }

  private statusOf(state: DeliveryState): WebhookDeliveryStatus {
    return {
      active: state.active,
      lastDeliveryAt: iso(state.lastDeliveryAt),
      lastError: state.lastError,
      ...(state.failedSince !== null ? { failedSince: iso(state.failedSince) } : {}),
    };
  }

  private isExpired(state: DeliveryState): boolean {
    return state.record.expiresAt !== null && state.record.expiresAt <= Date.now();
  }

  private expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private scheduleExpiry(state: DeliveryState): void {
    const { id, expiresAt } = state.record;
    const existing = this.expiryTimers.get(id);
    if (existing) clearTimeout(existing);
    this.expiryTimers.delete(id);
    if (expiresAt === null) return;
    const timer = setTimeout(
      () => {
        this.expiryTimers.delete(id);
        if (this.isExpired(state)) void this.expire(id);
        else this.scheduleExpiry(state);
      },
      Math.min(Math.max(expiresAt - Date.now(), 0), MAX_TIMER_MS),
    );
    timer.unref?.();
    this.expiryTimers.set(id, timer);
  }

  private async expire(id: string): Promise<void> {
    this.dropState(id);
    await this.store.delete(id);
  }

  private dropState(id: string): void {
    const state = this.states.get(id);
    const expiry = this.expiryTimers.get(id);
    if (expiry) clearTimeout(expiry);
    this.expiryTimers.delete(id);
    if (!state) return;
    state.closed = true;
    for (const timer of state.timers) clearTimeout(timer);
    state.timers.clear();
    this.states.delete(id);
  }

  private setTimer(state: DeliveryState, fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      state.timers.delete(timer);
      fn();
    }, ms);
    timer.unref?.();
    state.timers.add(timer);
    return timer;
  }

  private clearTimer(state: DeliveryState, pending: PendingDelivery): void {
    if (!pending.timer) return;
    clearTimeout(pending.timer);
    state.timers.delete(pending.timer);
    pending.timer = undefined;
  }
}

function echoes(body: string, challenge: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }
  if (typeof parsed !== 'object' || parsed === null || !('challenge' in parsed)) return false;
  const echoed = parsed.challenge;
  if (typeof echoed !== 'string') return false;
  const a = Buffer.from(echoed);
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}
