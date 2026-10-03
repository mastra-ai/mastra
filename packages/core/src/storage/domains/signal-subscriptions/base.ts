import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { StorageDomain } from '../base';

/**
 * How long a signal-subscriptions store keeps its rows.
 *
 * - `process`: rows live only as long as the current process (the in-memory store).
 * - `persistent`: rows survive restarts and are shared by every process that
 *   points at the same database (libSQL, PostgreSQL).
 */
export type SignalSubscriptionDurability = 'process' | 'persistent';

/** Membership operation staged on a subscription row. */
export type SignalSubscriptionOperationKind = 'subscribe' | 'unsubscribe';

/**
 * A durable signal subscription: one agent's provider watching one external
 * resource on behalf of one `(resourceId, threadId)` target.
 */
export type SignalSubscriptionRecord = {
  id: string;
  agentId: string;
  providerId: string;
  threadId: string;
  resourceId: string;
  externalResourceId: string;
  metadata: Record<string, unknown>;
  /** Delivery options the provider applies when notifying, e.g. `{ ifIdle: true }`. */
  deliveryOptions: Record<string, unknown>;
  enabled: boolean;
  /** Crash-recoverable membership staging. Absent when no operation is staged. */
  operationKind?: SignalSubscriptionOperationKind;
  operationOwner?: string;
  /** Storage-time lease expiry of the staged operation, epoch ms. */
  operationExpiresAt?: number;
  /** Current poll-claim owner. Absent when unclaimed. */
  claimOwner?: string;
  /** Storage-time expiry of the poll claim, epoch ms. */
  claimExpiresAt?: number;
  createdAt: Date;
  updatedAt: Date;
  lastPolledAt?: Date;
  /** Reserves one polling cadence across replicas. */
  nextPollAt?: Date;
  lastDeliveredAt?: Date;
  /** Provider-supplied poll cursor. */
  cursor?: Record<string, unknown>;
};

/**
 * The unique identity of a subscription. `agentId` and `resourceId` are part
 * of the identity so two agents sharing a provider id, or two resources
 * sharing a thread id, never see each other's subscriptions.
 */
export type SignalSubscriptionIdentity = {
  agentId: string;
  providerId: string;
  resourceId: string;
  threadId: string;
  externalResourceId: string;
};

/** A row in the delivery ledger, keyed by `(subscriptionId, deliveryId)`. */
export type SignalSubscriptionDelivery = {
  subscriptionId: string;
  deliveryId: string;
  createdAt: Date;
} & (
  | { status: 'pending'; owner: string; expiresAt: number; deliveredAt?: never }
  | { status: 'delivered'; deliveredAt: Date; owner?: never; expiresAt?: never }
);

/** An expiring lock that serializes writers of one shared document. */
export type SignalSubscriptionCoordinationLock = {
  /** Shared document identity, e.g. one GitHub thread metadata document. */
  key: string;
  owner: string;
  expiresAt: number;
};

/** Proof of document ownership, passed to every mutation of an owned document's rows. */
export type SignalSubscriptionDocumentFence = { key: string; fencingToken: string };

/**
 * Permanent ownership of one shared document by one agent+provider. Rows whose
 * `(providerId, resourceId, threadId)` matches an owner record can only be
 * mutated with that owner's fence.
 */
export type SignalSubscriptionDocumentOwner = {
  key: string;
  agentId: string;
  providerId: string;
  resourceId: string;
  threadId: string;
  /** New random token on each ownership claim. */
  fencingToken: string;
  createdAt: Date;
};

export type UpsertSignalSubscriptionInput = SignalSubscriptionIdentity & {
  /**
   * Row id for a new row. Ignored when the identity already exists. Generated
   * when omitted. Ids are unique across the domain: an id already used by
   * another subscription rejects.
   */
  id?: string;
  /** Shallow-merged into existing metadata. */
  metadata?: Record<string, unknown>;
  /** Replaces existing delivery options when supplied. */
  deliveryOptions?: Record<string, unknown>;
  /** Applied when supplied; otherwise new rows are enabled and existing rows keep their value. */
  enabled?: boolean;
};

export type SignalSubscriptionFilters = {
  agentId: string;
  providerId?: string;
  resourceId?: string;
  threadId?: string;
  externalResourceId?: string;
  enabled?: boolean;
};

export type ListSignalSubscriptionsInput = SignalSubscriptionFilters & {
  /** Omit for an exhaustive, untruncated result. */
  limit?: number;
  offset?: number;
};

export type ListSignalSubscriptionsResult = {
  subscriptions: SignalSubscriptionRecord[];
  /** Size of the full filtered set, independent of `limit`/`offset`. */
  total: number;
};

export type SignalSubscriptionPatch = {
  /** Replaces existing metadata. */
  metadata?: Record<string, unknown>;
  /** Replaces the cursor; `null` clears it. */
  cursor?: Record<string, unknown> | null;
  /** Replaces delivery options. */
  deliveryOptions?: Record<string, unknown>;
  lastPolledAt?: Date;
  lastDeliveredAt?: Date;
};

/** A subscription row by id, matched only within its agent and provider. */
export type SignalSubscriptionRowRef = { agentId: string; providerId: string; id: string };

export type ClaimSignalSubscriptionInput = SignalSubscriptionRowRef & {
  owner: string;
  ttlMs: number;
  /** Cadence reserved by a fresh or forced claim: `nextPollAt = storage now + cadenceMs`. */
  cadenceMs: number;
  /** Bypass `nextPollAt` on an unclaimed or expired row. Never steals a live claim. */
  force?: boolean;
};

export type ListSignalSubscriptionDocumentOwnersInput = {
  agentId?: string;
  providerId?: string;
  resourceId?: string;
  threadId?: string;
  limit?: number;
  offset?: number;
};

export type ListSignalSubscriptionDocumentOwnersResult = {
  owners: SignalSubscriptionDocumentOwner[];
  total: number;
};

export type SignalSubscriptionDeliveryRef = { subscriptionId: string; deliveryId: string };

/** `'missing'` when the subscription does not exist; no ledger row is written. */
export type ClaimSignalSubscriptionDeliveryResult = 'claimed' | 'in-progress' | 'delivered' | 'missing';

/** Thrown when a mutation of an owned document's row lacks a valid fence. */
export class SignalSubscriptionFenceError extends MastraError {
  constructor(details: Record<string, string>) {
    super({
      id: 'STORAGE_SIGNAL_SUBSCRIPTIONS_FENCE_REJECTED',
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: 'Signal subscription mutation rejected: the row belongs to an owned document and no valid fence was supplied',
      details,
    });
  }
}

/**
 * Abstract base class for the signal-subscriptions storage domain.
 *
 * Holds durable `SignalProvider` subscriptions, their per-replica poll claims,
 * a delivery ledger for webhook dedupe, and the coordination rows (expiring
 * locks and permanent document owners) providers use to serialize writes to
 * shared documents.
 *
 * Real adapters make every due/expiry decision with database time and every
 * transition with a single guarded statement, so concurrent replicas sharing
 * the database coordinate correctly. Callers never supply timestamps.
 *
 * Contract highlights:
 * - Poll claims require an enabled row with no live membership operation and
 *   never steal a live claim. A fresh or forced claim reserves the next cadence
 *   (`nextPollAt = now + cadenceMs`); taking over an expired claim preserves
 *   it; release clears ownership but preserves `nextPollAt`.
 * - Delivery claims are `'claimed'` for new or expired keys, `'in-progress'`
 *   for any live pending key (including the same owner), `'delivered'`
 *   once completed, and `'missing'` when the subscription does not exist.
 *   A key completed while a claim waited on it may still read `'in-progress'`
 *   (PostgreSQL reads the ledger as of the statement start); callers treat
 *   both as "skip, someone else has it".
 *   Delivered identities are kept until their subscription is deleted, so the
 *   ledger never outlives its subscription.
 * - Rows of an owned document can only be mutated with that owner's fence.
 */
export abstract class SignalSubscriptionsStorage extends StorageDomain {
  abstract readonly durability: SignalSubscriptionDurability;

  constructor() {
    super({
      component: 'STORAGE',
      name: 'SIGNAL_SUBSCRIPTIONS',
    });
  }

  /** True when no subscription, delivery, lock, or document-owner row exists. */
  abstract isEmpty(): Promise<boolean>;

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------

  /**
   * Insert or update by five-part identity. On conflict: metadata is
   * shallow-merged, `deliveryOptions` replaced only when supplied, `enabled`
   * applied only when supplied, `updatedAt` refreshed; id, createdAt, claims,
   * live membership operation, `nextPollAt`, and cursor are preserved.
   */
  abstract upsertSubscription(
    input: UpsertSignalSubscriptionInput,
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord>;

  abstract getSubscriptionById(args: SignalSubscriptionRowRef): Promise<SignalSubscriptionRecord | null>;

  abstract getSubscriptionByIdentity(identity: SignalSubscriptionIdentity): Promise<SignalSubscriptionRecord | null>;

  /**
   * List in stable `createdAt ASC, id ASC` order. Omitted `limit` returns every
   * row. Offset pages are not stable across concurrent writers; callers that
   * must see every row omit `limit`/`offset`.
   */
  abstract listSubscriptions(args: ListSignalSubscriptionsInput): Promise<ListSignalSubscriptionsResult>;

  /** Enabled rows of this agent+provider watching `externalResourceId`, across every resource and thread. */
  abstract listSubscriptionsForResource(args: {
    agentId: string;
    providerId: string;
    externalResourceId: string;
  }): Promise<SignalSubscriptionRecord[]>;

  abstract countSubscriptions(filters: SignalSubscriptionFilters): Promise<number>;

  /** Apply `patch` and refresh `updatedAt`. Returns `null` when the row does not exist. */
  abstract updateSubscription(
    args: SignalSubscriptionRowRef & { patch: SignalSubscriptionPatch },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null>;

  abstract setSubscriptionEnabled(
    args: SignalSubscriptionRowRef & { enabled: boolean },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null>;

  /** Delete the row and its delivery ledger. Returns whether a row was deleted. */
  abstract deleteSubscription(
    args: SignalSubscriptionRowRef,
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<boolean>;

  /**
   * Delete every matching row and its delivery ledger. All-or-nothing: if any
   * matched row belongs to an owned document without a valid fence in
   * `fences`, nothing is deleted and {@link SignalSubscriptionFenceError} is thrown.
   */
  abstract deleteSubscriptions(
    filters: SignalSubscriptionFilters,
    fences?: SignalSubscriptionDocumentFence[],
  ): Promise<number>;

  // ---------------------------------------------------------------------------
  // Membership operations
  // ---------------------------------------------------------------------------

  /**
   * Insert a new disabled row with a live `subscribe` operation owned by
   * `owner`. Returns `null` when the identity already exists.
   */
  abstract insertSubscribingSubscription(
    input: Omit<UpsertSignalSubscriptionInput, 'enabled'> & { owner: string; ttlMs: number },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null>;

  /**
   * Stage a membership operation on an existing row, or take over an expired
   * one. Fails (returns `null`) while another owner's operation is live, and a
   * `subscribe` on an enabled row also fails while a poll claim is live.
   */
  abstract beginSubscriptionOperation(
    args: SignalSubscriptionRowRef & { kind: SignalSubscriptionOperationKind; owner: string; ttlMs: number },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null>;

  /** Extend a live operation owned by `owner`. */
  abstract renewSubscriptionOperation(
    args: SignalSubscriptionRowRef & { owner: string; ttlMs: number },
  ): Promise<boolean>;

  /** Enable the row and clear its live `subscribe` operation owned by `owner`. */
  abstract commitSubscribe(
    args: SignalSubscriptionRowRef & { owner: string },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null>;

  /**
   * Delete a disabled row whose live `unsubscribe` operation is owned by
   * `owner` and which has no live poll claim; cascades its delivery ledger.
   */
  abstract commitUnsubscribe(
    args: SignalSubscriptionRowRef & { owner: string },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<boolean>;

  /** Clear the operation owned by `owner`, leaving the row otherwise unchanged. */
  abstract abortSubscriptionOperation(
    args: SignalSubscriptionRowRef & { owner: string },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<boolean>;

  // ---------------------------------------------------------------------------
  // Poll claims
  // ---------------------------------------------------------------------------

  /** Claim the row for polling. Returns the claimed row, or `null` when not claimable. */
  abstract claimSubscription(args: ClaimSignalSubscriptionInput): Promise<SignalSubscriptionRecord | null>;

  /** Extend a live claim on an enabled row with no live membership operation. */
  abstract renewSubscriptionClaimIfEnabled(
    args: SignalSubscriptionRowRef & { owner: string; ttlMs: number },
  ): Promise<boolean>;

  /** True while `owner` holds a live claim on an enabled row with no live membership operation. */
  abstract validateSubscriptionClaimIfEnabled(args: SignalSubscriptionRowRef & { owner: string }): Promise<boolean>;

  /** Clear `owner`'s claim, preserving `nextPollAt`. */
  abstract releaseSubscriptionClaim(args: SignalSubscriptionRowRef & { owner: string }): Promise<boolean>;

  // ---------------------------------------------------------------------------
  // Document owners
  // ---------------------------------------------------------------------------

  /**
   * Become the permanent owner of `key`. Returns the existing record when the
   * same agent+provider+resource+thread already owns it, `null` when someone
   * else owns `key` or another key already owns the provider+resource+thread
   * document. A document has at most one owner.
   */
  abstract claimDocumentOwner(args: {
    key: string;
    agentId: string;
    providerId: string;
    resourceId: string;
    threadId: string;
  }): Promise<SignalSubscriptionDocumentOwner | null>;

  /**
   * Release ownership held under `fencingToken`. Succeeds only when no
   * subscription row of the document remains.
   */
  abstract releaseDocumentOwner(args: {
    key: string;
    agentId: string;
    providerId: string;
    fencingToken: string;
  }): Promise<boolean>;

  /** List owners in stable `createdAt ASC, key ASC` order. */
  abstract listDocumentOwners(
    args: ListSignalSubscriptionDocumentOwnersInput,
  ): Promise<ListSignalSubscriptionDocumentOwnersResult>;

  // ---------------------------------------------------------------------------
  // Coordination locks
  // ---------------------------------------------------------------------------

  /** Acquire `key` when it is free or its previous holder expired. */
  abstract claimCoordinationLock(args: { key: string; owner: string; ttlMs: number }): Promise<boolean>;

  abstract renewCoordinationLock(args: { key: string; owner: string; ttlMs: number }): Promise<boolean>;

  abstract releaseCoordinationLock(args: { key: string; owner: string }): Promise<boolean>;

  // ---------------------------------------------------------------------------
  // Delivery ledger
  // ---------------------------------------------------------------------------

  abstract claimDelivery(
    args: SignalSubscriptionDeliveryRef & { owner: string; ttlMs: number },
  ): Promise<ClaimSignalSubscriptionDeliveryResult>;

  abstract renewDeliveryClaim(args: SignalSubscriptionDeliveryRef & { owner: string; ttlMs: number }): Promise<boolean>;

  /** Mark `owner`'s pending delivery as delivered. */
  abstract completeDelivery(args: SignalSubscriptionDeliveryRef & { owner: string }): Promise<boolean>;

  /** Remove `owner`'s pending delivery so it can be retried. Never removes delivered rows. */
  abstract releaseDelivery(args: SignalSubscriptionDeliveryRef & { owner: string }): Promise<boolean>;

  abstract getDelivery(args: SignalSubscriptionDeliveryRef): Promise<SignalSubscriptionDelivery | null>;
}
