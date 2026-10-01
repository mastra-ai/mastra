import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type {
  ClaimSignalSubscriptionDeliveryResult,
  ClaimSignalSubscriptionInput,
  ListSignalSubscriptionDocumentOwnersInput,
  ListSignalSubscriptionDocumentOwnersResult,
  ListSignalSubscriptionsInput,
  ListSignalSubscriptionsResult,
  SignalSubscriptionDelivery,
  SignalSubscriptionDeliveryRef,
  SignalSubscriptionDocumentFence,
  SignalSubscriptionDocumentOwner,
  SignalSubscriptionDurability,
  SignalSubscriptionFilters,
  SignalSubscriptionIdentity,
  SignalSubscriptionOperationKind,
  SignalSubscriptionPatch,
  SignalSubscriptionRecord,
  SignalSubscriptionRowRef,
  UpsertSignalSubscriptionInput,
} from './base';
import { SignalSubscriptionFenceError, SignalSubscriptionsStorage } from './base';

export type InMemorySignalSubscriptionsStorageOptions = {
  /**
   * Durability this store reports. Defaults to `'process'`.
   *
   * @internal Test double only. `'persistent'` lets unit tests exercise the
   * durable-storage paths without a database; rows still die with the process,
   * so it must never be used outside tests.
   */
  durability?: SignalSubscriptionDurability;
  /** Clock used for every due/expiry decision. Defaults to `Date.now`. */
  now?: () => number;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function identityKey(identity: SignalSubscriptionIdentity): string {
  return JSON.stringify([
    identity.agentId,
    identity.providerId,
    identity.resourceId,
    identity.threadId,
    identity.externalResourceId,
  ]);
}

function deliveryKey(ref: SignalSubscriptionDeliveryRef): string {
  return JSON.stringify([ref.subscriptionId, ref.deliveryId]);
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function page<T>(items: T[], limit: number | undefined, offset: number | undefined): T[] {
  const start = offset ?? 0;
  return limit === undefined ? items.slice(start) : items.slice(start, start + limit);
}

/**
 * In-memory implementation of {@link SignalSubscriptionsStorage}.
 *
 * The default store when no storage is configured. Rows live only as long as
 * the process (`durability === 'process'`), so subscriptions do not survive a
 * restart and are not shared between processes — configure a persistent
 * adapter (e.g. `@mastra/libsql` or `@mastra/pg`) for that.
 */
export class InMemorySignalSubscriptionsStorage extends SignalSubscriptionsStorage {
  readonly durability: SignalSubscriptionDurability;

  readonly #now: () => number;
  readonly #subscriptions = new Map<string, SignalSubscriptionRecord>();
  readonly #deliveries = new Map<string, SignalSubscriptionDelivery>();
  readonly #locks = new Map<string, { owner: string; expiresAt: number }>();
  readonly #owners = new Map<string, SignalSubscriptionDocumentOwner>();

  constructor(options: InMemorySignalSubscriptionsStorageOptions = {}) {
    super();
    this.durability = options.durability ?? 'process';
    this.#now = options.now ?? Date.now;
  }

  async init(): Promise<void> {
    // No-op for in-memory store.
  }

  async isEmpty(): Promise<boolean> {
    return (
      this.#subscriptions.size === 0 && this.#deliveries.size === 0 && this.#locks.size === 0 && this.#owners.size === 0
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    this.#subscriptions.clear();
    this.#deliveries.clear();
    this.#locks.clear();
    this.#owners.clear();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  #findById({ agentId, providerId, id }: SignalSubscriptionRowRef): SignalSubscriptionRecord | undefined {
    for (const row of this.#subscriptions.values()) {
      if (row.id === id && row.agentId === agentId && row.providerId === providerId) return row;
    }
    return undefined;
  }

  #ownerForDocument(row: Pick<SignalSubscriptionIdentity, 'providerId' | 'resourceId' | 'threadId'>) {
    for (const owner of this.#owners.values()) {
      if (
        owner.providerId === row.providerId &&
        owner.resourceId === row.resourceId &&
        owner.threadId === row.threadId
      ) {
        return owner;
      }
    }
    return undefined;
  }

  #fenceValid(identity: SignalSubscriptionIdentity, fence: SignalSubscriptionDocumentFence | undefined): boolean {
    const owner = this.#ownerForDocument(identity);
    if (!fence) return owner === undefined;
    return (
      owner !== undefined &&
      owner.key === fence.key &&
      owner.fencingToken === fence.fencingToken &&
      owner.agentId === identity.agentId
    );
  }

  #fenceError(identity: SignalSubscriptionIdentity, fence: SignalSubscriptionDocumentFence | undefined) {
    return new SignalSubscriptionFenceError({
      agentId: identity.agentId,
      providerId: identity.providerId,
      resourceId: identity.resourceId,
      threadId: identity.threadId,
      fenceKey: fence?.key ?? '',
    });
  }

  #assertFence(identity: SignalSubscriptionIdentity, fence: SignalSubscriptionDocumentFence | undefined): void {
    if (!this.#fenceValid(identity, fence)) throw this.#fenceError(identity, fence);
  }

  #liveOperation(row: SignalSubscriptionRecord, now: number): boolean {
    return row.operationOwner !== undefined && (row.operationExpiresAt ?? 0) > now;
  }

  #liveClaim(row: SignalSubscriptionRecord, now: number): boolean {
    return row.claimOwner !== undefined && (row.claimExpiresAt ?? 0) > now;
  }

  #clearOperation(row: SignalSubscriptionRecord): void {
    delete row.operationKind;
    delete row.operationOwner;
    delete row.operationExpiresAt;
  }

  #matches(row: SignalSubscriptionRecord, filters: SignalSubscriptionFilters): boolean {
    return (
      row.agentId === filters.agentId &&
      (filters.providerId === undefined || row.providerId === filters.providerId) &&
      (filters.resourceId === undefined || row.resourceId === filters.resourceId) &&
      (filters.threadId === undefined || row.threadId === filters.threadId) &&
      (filters.externalResourceId === undefined || row.externalResourceId === filters.externalResourceId) &&
      (filters.enabled === undefined || row.enabled === filters.enabled)
    );
  }

  #sorted(filters: SignalSubscriptionFilters): SignalSubscriptionRecord[] {
    return [...this.#subscriptions.values()]
      .filter(row => this.#matches(row, filters))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || compareIds(a.id, b.id));
  }

  #delete(row: SignalSubscriptionRecord): void {
    this.#subscriptions.delete(identityKey(row));
    for (const [key, delivery] of this.#deliveries) {
      if (delivery.subscriptionId === row.id) this.#deliveries.delete(key);
    }
  }

  #newRow(
    input: UpsertSignalSubscriptionInput,
    now: number,
    operation?: { kind: SignalSubscriptionOperationKind; owner: string; ttlMs: number },
  ): SignalSubscriptionRecord {
    if (input.id !== undefined && [...this.#subscriptions.values()].some(existing => existing.id === input.id)) {
      throw new MastraError({
        id: 'STORAGE_SIGNAL_SUBSCRIPTIONS_DUPLICATE_ID',
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: `Signal subscription id "${input.id}" is already used by another subscription`,
        details: { id: input.id },
      });
    }
    const row: SignalSubscriptionRecord = {
      id: input.id ?? crypto.randomUUID(),
      agentId: input.agentId,
      providerId: input.providerId,
      resourceId: input.resourceId,
      threadId: input.threadId,
      externalResourceId: input.externalResourceId,
      metadata: clone(input.metadata ?? {}),
      deliveryOptions: clone(input.deliveryOptions ?? {}),
      enabled: operation ? false : (input.enabled ?? true),
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };
    if (operation) {
      row.operationKind = operation.kind;
      row.operationOwner = operation.owner;
      row.operationExpiresAt = now + operation.ttlMs;
    }
    this.#subscriptions.set(identityKey(row), row);
    return row;
  }

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------

  async upsertSubscription(
    input: UpsertSignalSubscriptionInput,
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord> {
    this.#assertFence(input, fence);
    const now = this.#now();
    const existing = this.#subscriptions.get(identityKey(input));
    if (!existing) return clone(this.#newRow(input, now));

    if (input.metadata) existing.metadata = { ...existing.metadata, ...clone(input.metadata) };
    if (input.deliveryOptions) existing.deliveryOptions = clone(input.deliveryOptions);
    if (input.enabled !== undefined) existing.enabled = input.enabled;
    existing.updatedAt = new Date(now);
    return clone(existing);
  }

  async getSubscriptionById(args: SignalSubscriptionRowRef): Promise<SignalSubscriptionRecord | null> {
    const row = this.#findById(args);
    return row ? clone(row) : null;
  }

  async getSubscriptionByIdentity(identity: SignalSubscriptionIdentity): Promise<SignalSubscriptionRecord | null> {
    const row = this.#subscriptions.get(identityKey(identity));
    return row ? clone(row) : null;
  }

  async listSubscriptions(args: ListSignalSubscriptionsInput): Promise<ListSignalSubscriptionsResult> {
    const rows = this.#sorted(args);
    return { subscriptions: page(rows, args.limit, args.offset).map(clone), total: rows.length };
  }

  async listSubscriptionsForResource(args: {
    agentId: string;
    providerId: string;
    externalResourceId: string;
  }): Promise<SignalSubscriptionRecord[]> {
    return this.#sorted({ ...args, enabled: true }).map(clone);
  }

  async countSubscriptions(filters: SignalSubscriptionFilters): Promise<number> {
    return this.#sorted(filters).length;
  }

  async updateSubscription(
    args: SignalSubscriptionRowRef & { patch: SignalSubscriptionPatch },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null> {
    const row = this.#findById(args);
    if (!row) return null;
    this.#assertFence(row, fence);
    const { patch } = args;
    if (patch.metadata) row.metadata = clone(patch.metadata);
    if (patch.deliveryOptions) row.deliveryOptions = clone(patch.deliveryOptions);
    if (patch.cursor === null) delete row.cursor;
    else if (patch.cursor !== undefined) row.cursor = clone(patch.cursor);
    if (patch.lastPolledAt) row.lastPolledAt = new Date(patch.lastPolledAt);
    if (patch.lastDeliveredAt) row.lastDeliveredAt = new Date(patch.lastDeliveredAt);
    row.updatedAt = new Date(this.#now());
    return clone(row);
  }

  async setSubscriptionEnabled(
    args: SignalSubscriptionRowRef & { enabled: boolean },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null> {
    const row = this.#findById(args);
    if (!row) return null;
    this.#assertFence(row, fence);
    row.enabled = args.enabled;
    row.updatedAt = new Date(this.#now());
    return clone(row);
  }

  async deleteSubscription(args: SignalSubscriptionRowRef, fence?: SignalSubscriptionDocumentFence): Promise<boolean> {
    const row = this.#findById(args);
    if (!row) return false;
    this.#assertFence(row, fence);
    this.#delete(row);
    return true;
  }

  async deleteSubscriptions(
    filters: SignalSubscriptionFilters,
    fences: SignalSubscriptionDocumentFence[] = [],
  ): Promise<number> {
    const rows = this.#sorted(filters);
    for (const row of rows) {
      if (this.#ownerForDocument(row) === undefined) continue;
      if (!fences.some(fence => this.#fenceValid(row, fence))) throw this.#fenceError(row, undefined);
    }
    for (const row of rows) this.#delete(row);
    return rows.length;
  }

  // ---------------------------------------------------------------------------
  // Membership operations
  // ---------------------------------------------------------------------------

  async insertSubscribingSubscription(
    input: Omit<UpsertSignalSubscriptionInput, 'enabled'> & { owner: string; ttlMs: number },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null> {
    this.#assertFence(input, fence);
    if (this.#subscriptions.has(identityKey(input))) return null;
    return clone(this.#newRow(input, this.#now(), { kind: 'subscribe', owner: input.owner, ttlMs: input.ttlMs }));
  }

  async beginSubscriptionOperation(
    args: SignalSubscriptionRowRef & { kind: SignalSubscriptionOperationKind; owner: string; ttlMs: number },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null> {
    const row = this.#findById(args);
    if (!row) return null;
    this.#assertFence(row, fence);
    const now = this.#now();
    if (this.#liveOperation(row, now) && row.operationOwner !== args.owner) return null;
    if (args.kind === 'subscribe' && row.enabled && this.#liveClaim(row, now)) return null;
    row.operationKind = args.kind;
    row.operationOwner = args.owner;
    row.operationExpiresAt = now + args.ttlMs;
    row.updatedAt = new Date(now);
    return clone(row);
  }

  async renewSubscriptionOperation(
    args: SignalSubscriptionRowRef & { owner: string; ttlMs: number },
  ): Promise<boolean> {
    const row = this.#findById(args);
    const now = this.#now();
    if (!row || row.operationOwner !== args.owner || !this.#liveOperation(row, now)) return false;
    row.operationExpiresAt = now + args.ttlMs;
    return true;
  }

  async commitSubscribe(
    args: SignalSubscriptionRowRef & { owner: string },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null> {
    const row = this.#findById(args);
    if (!row) return null;
    this.#assertFence(row, fence);
    const now = this.#now();
    if (row.operationKind !== 'subscribe' || row.operationOwner !== args.owner || !this.#liveOperation(row, now)) {
      return null;
    }
    this.#clearOperation(row);
    row.enabled = true;
    row.updatedAt = new Date(now);
    return clone(row);
  }

  async commitUnsubscribe(
    args: SignalSubscriptionRowRef & { owner: string },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<boolean> {
    const row = this.#findById(args);
    if (!row) return false;
    this.#assertFence(row, fence);
    const now = this.#now();
    if (
      row.enabled ||
      row.operationKind !== 'unsubscribe' ||
      row.operationOwner !== args.owner ||
      !this.#liveOperation(row, now) ||
      this.#liveClaim(row, now)
    ) {
      return false;
    }
    this.#delete(row);
    return true;
  }

  async abortSubscriptionOperation(
    args: SignalSubscriptionRowRef & { owner: string },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<boolean> {
    const row = this.#findById(args);
    if (!row) return false;
    this.#assertFence(row, fence);
    if (row.operationOwner !== args.owner) return false;
    this.#clearOperation(row);
    row.updatedAt = new Date(this.#now());
    return true;
  }

  // ---------------------------------------------------------------------------
  // Poll claims
  // ---------------------------------------------------------------------------

  async claimSubscription(args: ClaimSignalSubscriptionInput): Promise<SignalSubscriptionRecord | null> {
    const row = this.#findById(args);
    const now = this.#now();
    if (!row || !row.enabled || this.#liveOperation(row, now) || this.#liveClaim(row, now)) return null;

    const expiredTakeover = row.claimOwner !== undefined;
    const due = row.nextPollAt === undefined || row.nextPollAt.getTime() <= now;
    if (!args.force && !expiredTakeover && !due) return null;

    row.claimOwner = args.owner;
    row.claimExpiresAt = now + args.ttlMs;
    if (args.force || !expiredTakeover) row.nextPollAt = new Date(now + args.cadenceMs);
    return clone(row);
  }

  async renewSubscriptionClaimIfEnabled(
    args: SignalSubscriptionRowRef & { owner: string; ttlMs: number },
  ): Promise<boolean> {
    const row = this.#findById(args);
    const now = this.#now();
    if (!row || !this.#ownsLiveEnabledClaim(row, args.owner, now)) return false;
    row.claimExpiresAt = now + args.ttlMs;
    return true;
  }

  async validateSubscriptionClaimIfEnabled(args: SignalSubscriptionRowRef & { owner: string }): Promise<boolean> {
    const row = this.#findById(args);
    return row !== undefined && this.#ownsLiveEnabledClaim(row, args.owner, this.#now());
  }

  #ownsLiveEnabledClaim(row: SignalSubscriptionRecord, owner: string, now: number): boolean {
    return row.enabled && !this.#liveOperation(row, now) && row.claimOwner === owner && this.#liveClaim(row, now);
  }

  async releaseSubscriptionClaim(args: SignalSubscriptionRowRef & { owner: string }): Promise<boolean> {
    const row = this.#findById(args);
    if (!row || row.claimOwner !== args.owner) return false;
    delete row.claimOwner;
    delete row.claimExpiresAt;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Document owners
  // ---------------------------------------------------------------------------

  async claimDocumentOwner(args: {
    key: string;
    agentId: string;
    providerId: string;
    resourceId: string;
    threadId: string;
  }): Promise<SignalSubscriptionDocumentOwner | null> {
    const existing = this.#owners.get(args.key);
    if (existing) {
      const same =
        existing.agentId === args.agentId &&
        existing.providerId === args.providerId &&
        existing.resourceId === args.resourceId &&
        existing.threadId === args.threadId;
      return same ? clone(existing) : null;
    }
    if (this.#ownerForDocument(args)) return null;
    const owner: SignalSubscriptionDocumentOwner = {
      key: args.key,
      agentId: args.agentId,
      providerId: args.providerId,
      resourceId: args.resourceId,
      threadId: args.threadId,
      fencingToken: crypto.randomUUID(),
      createdAt: new Date(this.#now()),
    };
    this.#owners.set(args.key, owner);
    return clone(owner);
  }

  async releaseDocumentOwner(args: {
    key: string;
    agentId: string;
    providerId: string;
    fencingToken: string;
  }): Promise<boolean> {
    const owner = this.#owners.get(args.key);
    if (
      !owner ||
      owner.agentId !== args.agentId ||
      owner.providerId !== args.providerId ||
      owner.fencingToken !== args.fencingToken
    ) {
      return false;
    }
    for (const row of this.#subscriptions.values()) {
      if (
        row.providerId === owner.providerId &&
        row.resourceId === owner.resourceId &&
        row.threadId === owner.threadId
      ) {
        return false;
      }
    }
    this.#owners.delete(args.key);
    return true;
  }

  async listDocumentOwners(
    args: ListSignalSubscriptionDocumentOwnersInput,
  ): Promise<ListSignalSubscriptionDocumentOwnersResult> {
    const owners = [...this.#owners.values()]
      .filter(
        owner =>
          (args.agentId === undefined || owner.agentId === args.agentId) &&
          (args.providerId === undefined || owner.providerId === args.providerId) &&
          (args.resourceId === undefined || owner.resourceId === args.resourceId) &&
          (args.threadId === undefined || owner.threadId === args.threadId),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || compareIds(a.key, b.key));
    return { owners: page(owners, args.limit, args.offset).map(clone), total: owners.length };
  }

  // ---------------------------------------------------------------------------
  // Coordination locks
  // ---------------------------------------------------------------------------

  async claimCoordinationLock(args: { key: string; owner: string; ttlMs: number }): Promise<boolean> {
    const now = this.#now();
    const lock = this.#locks.get(args.key);
    if (lock && lock.expiresAt > now) return false;
    this.#locks.set(args.key, { owner: args.owner, expiresAt: now + args.ttlMs });
    return true;
  }

  async renewCoordinationLock(args: { key: string; owner: string; ttlMs: number }): Promise<boolean> {
    const now = this.#now();
    const lock = this.#locks.get(args.key);
    if (!lock || lock.owner !== args.owner || lock.expiresAt <= now) return false;
    lock.expiresAt = now + args.ttlMs;
    return true;
  }

  async releaseCoordinationLock(args: { key: string; owner: string }): Promise<boolean> {
    const lock = this.#locks.get(args.key);
    if (!lock || lock.owner !== args.owner) return false;
    this.#locks.delete(args.key);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Delivery ledger
  // ---------------------------------------------------------------------------

  async claimDelivery(
    args: SignalSubscriptionDeliveryRef & { owner: string; ttlMs: number },
  ): Promise<ClaimSignalSubscriptionDeliveryResult> {
    if (![...this.#subscriptions.values()].some(row => row.id === args.subscriptionId)) return 'missing';
    const now = this.#now();
    const key = deliveryKey(args);
    const existing = this.#deliveries.get(key);
    if (existing?.status === 'delivered') return 'delivered';
    if (existing && existing.expiresAt > now) return 'in-progress';
    this.#deliveries.set(key, {
      subscriptionId: args.subscriptionId,
      deliveryId: args.deliveryId,
      createdAt: existing?.createdAt ?? new Date(now),
      status: 'pending',
      owner: args.owner,
      expiresAt: now + args.ttlMs,
    });
    return 'claimed';
  }

  async renewDeliveryClaim(args: SignalSubscriptionDeliveryRef & { owner: string; ttlMs: number }): Promise<boolean> {
    const now = this.#now();
    const delivery = this.#deliveries.get(deliveryKey(args));
    if (delivery?.status !== 'pending' || delivery.owner !== args.owner || delivery.expiresAt <= now) return false;
    delivery.expiresAt = now + args.ttlMs;
    return true;
  }

  async completeDelivery(args: SignalSubscriptionDeliveryRef & { owner: string }): Promise<boolean> {
    const key = deliveryKey(args);
    const delivery = this.#deliveries.get(key);
    if (delivery?.status !== 'pending' || delivery.owner !== args.owner) return false;
    this.#deliveries.set(key, {
      subscriptionId: delivery.subscriptionId,
      deliveryId: delivery.deliveryId,
      createdAt: delivery.createdAt,
      status: 'delivered',
      deliveredAt: new Date(this.#now()),
    });
    return true;
  }

  async releaseDelivery(args: SignalSubscriptionDeliveryRef & { owner: string }): Promise<boolean> {
    const key = deliveryKey(args);
    const delivery = this.#deliveries.get(key);
    if (delivery?.status !== 'pending' || delivery.owner !== args.owner) return false;
    this.#deliveries.delete(key);
    return true;
  }

  async getDelivery(args: SignalSubscriptionDeliveryRef): Promise<SignalSubscriptionDelivery | null> {
    const delivery = this.#deliveries.get(deliveryKey(args));
    return delivery ? clone(delivery) : null;
  }
}
