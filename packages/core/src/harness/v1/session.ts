import type { HarnessStorage, SessionRecord } from '../../storage/domains/harness';
import { EventEmitter } from './events';
import type { HarnessEvent, HarnessEventListener, HarnessEventUnsubscribe, EmitInput } from './events';
import type { Harness } from './harness';
import type { SessionLifecycleState } from './types';

export interface SessionConstructorOptions {
  harness: Harness;
  storage: HarnessStorage;
  ownerId: string;
  record: SessionRecord;
  leaseExpiresAt: number;
  leaseTtlMs: number;
}

export class Session {
  private readonly harness: Harness;
  private readonly storage: HarnessStorage;
  private readonly ownerId: string;
  private readonly leaseTtlMs: number;
  private record: SessionRecord;
  private readonly emitter: EventEmitter;
  private lifecycle: SessionLifecycleState = 'live';
  private leaseRenewTimer?: ReturnType<typeof setTimeout>;

  constructor(opts: SessionConstructorOptions) {
    this.harness = opts.harness;
    this.storage = opts.storage;
    this.ownerId = opts.ownerId;
    this.leaseTtlMs = opts.leaseTtlMs;
    this.record = {
      ...opts.record,
      ownerId: opts.ownerId,
      leaseExpiresAt: opts.leaseExpiresAt,
    };
    this.emitter = new EventEmitter({ sessionId: opts.record.id });
    this.scheduleLeaseRenewal();
  }

  get id(): string {
    return this.record.id;
  }

  get resourceId(): string {
    return this.record.resourceId;
  }

  get threadId(): string {
    return this.record.threadId;
  }

  get parentSessionId(): string | undefined {
    return this.record.parentSessionId;
  }

  get modeId(): string {
    return this.record.modeId;
  }

  get modelId(): string {
    return this.record.modelId;
  }

  get lastActivityAt(): number {
    return this.record.lastActivityAt;
  }

  get lifecycleState(): SessionLifecycleState {
    return this.lifecycle;
  }

  get isClosed(): boolean {
    return this.lifecycle !== 'live';
  }

  getRecord(): SessionRecord {
    return this.record;
  }

  subscribe(listener: HarnessEventListener): HarnessEventUnsubscribe {
    return this.emitter.subscribe(listener);
  }

  async close(): Promise<void> {
    await this.harness._closeSession(this);
  }

  _emit(event: EmitInput): HarnessEvent {
    return this.emitter.emit(event);
  }

  _markClosed(record: SessionRecord): void {
    this.clearLeaseRenewal();
    this.record = record;
    this.lifecycle = 'closed';
  }

  _markEvicted(): void {
    this.clearLeaseRenewal();
    this.lifecycle = 'evicted';
  }

  _markWorkspaceLost(): void {
    // Workspace APIs land in a later slice. The registry records the state
    // here so future workspace calls can surface HarnessWorkspaceLostError.
  }

  async _kickQueueDrain(): Promise<void> {
    // Queue draining lands with the Session operations slice. Keeping this
    // no-op preserves the fork's hydration hook without starting work early.
  }

  /** @internal retained for future lease renewal/flush slices. */
  _internalStorage(): HarnessStorage {
    return this.storage;
  }

  /** @internal retained for future lease renewal/flush slices. */
  _internalOwnerId(): string {
    return this.ownerId;
  }

  private scheduleLeaseRenewal(): void {
    if (this.lifecycle !== 'live') return;
    this.clearLeaseRenewal();

    const leaseExpiresAt = this.record.leaseExpiresAt ?? Date.now() + this.leaseTtlMs;
    const msUntilExpiry = leaseExpiresAt - Date.now();
    const halfTtl = Math.max(1, Math.floor(this.leaseTtlMs / 2));
    const delay = Math.max(1, Math.min(halfTtl, msUntilExpiry > 1 ? msUntilExpiry - 1 : 1));

    this.leaseRenewTimer = setTimeout(() => {
      void this.renewLease();
    }, delay);
    this.leaseRenewTimer.unref?.();
  }

  private clearLeaseRenewal(): void {
    if (!this.leaseRenewTimer) return;
    clearTimeout(this.leaseRenewTimer);
    this.leaseRenewTimer = undefined;
  }

  private async renewLease(): Promise<void> {
    if (this.lifecycle !== 'live') return;

    try {
      const lease = await this.storage.renewSessionLease({
        sessionId: this.id,
        ownerId: this.ownerId,
        ttlMs: this.leaseTtlMs,
      });
      this.record = {
        ...this.record,
        ownerId: this.ownerId,
        leaseExpiresAt: lease.expiresAt,
        version: lease.version,
      };
      this.scheduleLeaseRenewal();
    } catch {
      await this.harness._evictSession(this, 'lease_lost');
    }
  }
}
