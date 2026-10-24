import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type {
  ClaimSignalSubscriptionDeliveryResult,
  ClaimSignalSubscriptionInput,
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
  SignalSubscriptionsStorage,
  UpsertSignalSubscriptionInput,
} from '../storage/domains/signal-subscriptions';

type Scoped<T> = Omit<T, 'agentId' | 'providerId'>;
/** New rows always get a generated id, so subscription ids are never caller-chosen. */
type NewRow<T> = Omit<T, 'agentId' | 'providerId' | 'id'>;
type RowRef = { id: string };
type Lease = { owner: string; ttlMs: number };

/**
 * Callback-scoped view of the `signalSubscriptions` domain handed to a
 * {@link SignalProvider} inside `withDurableSubscriptionStore()` /
 * `withConfiguredDurableSubscriptionStore()`.
 *
 * Every subscription and document-owner operation is bound to the connected
 * agent's id and the provider's id, so a provider can never read or write
 * another agent's or provider's rows, even by row id. Methods keep the names of the domain
 * methods they forward to; claim, operation, lock, and delivery helpers take
 * an explicit `owner`. Once its callback settles, every method rejects.
 *
 * @experimental Agent signals are experimental and may change in a future release.
 */
export interface DurableSubscriptionScope {
  /** Whether rows outlive the process (`'persistent'`) or live in process memory (`'process'`). */
  readonly durability: SignalSubscriptionDurability;

  // Subscriptions
  upsertSubscription(
    input: NewRow<UpsertSignalSubscriptionInput>,
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord>;
  getSubscriptionById(args: RowRef): Promise<SignalSubscriptionRecord | null>;
  getSubscriptionByIdentity(identity: Scoped<SignalSubscriptionIdentity>): Promise<SignalSubscriptionRecord | null>;
  listSubscriptions(args?: Scoped<ListSignalSubscriptionsInput>): Promise<ListSignalSubscriptionsResult>;
  listSubscriptionsForResource(args: { externalResourceId: string }): Promise<SignalSubscriptionRecord[]>;
  countSubscriptions(filters?: Scoped<SignalSubscriptionFilters>): Promise<number>;
  updateSubscription(
    args: RowRef & { patch: SignalSubscriptionPatch },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null>;
  setSubscriptionEnabled(
    args: RowRef & { enabled: boolean },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null>;
  deleteSubscription(args: RowRef, fence?: SignalSubscriptionDocumentFence): Promise<boolean>;
  deleteSubscriptions(
    filters?: Scoped<SignalSubscriptionFilters>,
    fences?: SignalSubscriptionDocumentFence[],
  ): Promise<number>;

  // Membership operations
  insertSubscribingSubscription(
    input: NewRow<Omit<UpsertSignalSubscriptionInput, 'enabled'>> & Lease,
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null>;
  beginSubscriptionOperation(
    args: RowRef & Lease & { kind: SignalSubscriptionOperationKind },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null>;
  renewSubscriptionOperation(args: RowRef & Lease): Promise<boolean>;
  commitSubscribe(
    args: RowRef & { owner: string },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<SignalSubscriptionRecord | null>;
  commitUnsubscribe(args: RowRef & { owner: string }, fence?: SignalSubscriptionDocumentFence): Promise<boolean>;
  abortSubscriptionOperation(
    args: RowRef & { owner: string },
    fence?: SignalSubscriptionDocumentFence,
  ): Promise<boolean>;

  // Poll claims
  claimSubscription(args: Scoped<ClaimSignalSubscriptionInput>): Promise<SignalSubscriptionRecord | null>;
  renewSubscriptionClaimIfEnabled(args: RowRef & Lease): Promise<boolean>;
  validateSubscriptionClaimIfEnabled(args: RowRef & { owner: string }): Promise<boolean>;
  releaseSubscriptionClaim(args: RowRef & { owner: string }): Promise<boolean>;

  // Document owners
  claimDocumentOwner(args: {
    key: string;
    resourceId: string;
    threadId: string;
  }): Promise<SignalSubscriptionDocumentOwner | null>;
  releaseDocumentOwner(args: { key: string; fencingToken: string }): Promise<boolean>;
  listDocumentOwners(args?: {
    resourceId?: string;
    threadId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ListSignalSubscriptionDocumentOwnersResult>;

  // Coordination locks
  claimCoordinationLock(args: { key: string } & Lease): Promise<boolean>;
  renewCoordinationLock(args: { key: string } & Lease): Promise<boolean>;
  releaseCoordinationLock(args: { key: string; owner: string }): Promise<boolean>;

  // Delivery ledger
  claimDelivery(args: SignalSubscriptionDeliveryRef & Lease): Promise<ClaimSignalSubscriptionDeliveryResult>;
  renewDeliveryClaim(args: SignalSubscriptionDeliveryRef & Lease): Promise<boolean>;
  completeDelivery(args: SignalSubscriptionDeliveryRef & { owner: string }): Promise<boolean>;
  releaseDelivery(args: SignalSubscriptionDeliveryRef & { owner: string }): Promise<boolean>;
  getDelivery(args: SignalSubscriptionDeliveryRef): Promise<SignalSubscriptionDelivery | null>;
}

/**
 * Build a scope over an already-resolved store. `agentId` is read lazily so
 * agent-independent helpers (coordination locks, delivery ledger) work before
 * `connect()`. Call `invalidate()` when the owning callback settles.
 *
 * @internal
 */
export function createDurableSubscriptionScope(
  store: SignalSubscriptionsStorage,
  owner: { providerId: string; agentId: () => string },
): { scope: DurableSubscriptionScope; invalidate: () => void } {
  let live = true;
  const { providerId } = owner;
  const use = () => {
    if (!live) {
      throw new MastraError({
        id: 'SIGNAL_PROVIDER_DURABLE_SCOPE_EXPIRED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: `[${providerId}] A durable subscription scope was used after its callback settled. Acquire a new one with withDurableSubscriptionStore().`,
        details: { providerId },
      });
    }
    return store;
  };
  const ids = () => {
    use();
    return { agentId: owner.agentId(), providerId };
  };
  const row = <A extends RowRef>(args: A): A & { agentId: string; providerId: string } => ({ ...args, ...ids() });

  const scope: DurableSubscriptionScope = {
    durability: store.durability,

    upsertSubscription: async (input, fence) => use().upsertSubscription({ ...input, id: undefined, ...ids() }, fence),
    getSubscriptionById: async args => use().getSubscriptionById(row(args)),
    getSubscriptionByIdentity: async identity => use().getSubscriptionByIdentity({ ...identity, ...ids() }),
    listSubscriptions: async (args = {}) => use().listSubscriptions({ ...args, ...ids() }),
    listSubscriptionsForResource: async args => use().listSubscriptionsForResource({ ...args, ...ids() }),
    countSubscriptions: async (filters = {}) => use().countSubscriptions({ ...filters, ...ids() }),
    updateSubscription: async (args, fence) => use().updateSubscription(row(args), fence),
    setSubscriptionEnabled: async (args, fence) => use().setSubscriptionEnabled(row(args), fence),
    deleteSubscription: async (args, fence) => use().deleteSubscription(row(args), fence),
    deleteSubscriptions: async (filters = {}, fences) => use().deleteSubscriptions({ ...filters, ...ids() }, fences),

    insertSubscribingSubscription: async (input, fence) =>
      use().insertSubscribingSubscription({ ...input, id: undefined, ...ids() }, fence),
    beginSubscriptionOperation: async (args, fence) => use().beginSubscriptionOperation(row(args), fence),
    renewSubscriptionOperation: async args => use().renewSubscriptionOperation(row(args)),
    commitSubscribe: async (args, fence) => use().commitSubscribe(row(args), fence),
    commitUnsubscribe: async (args, fence) => use().commitUnsubscribe(row(args), fence),
    abortSubscriptionOperation: async (args, fence) => use().abortSubscriptionOperation(row(args), fence),

    claimSubscription: async args => use().claimSubscription(row(args)),
    renewSubscriptionClaimIfEnabled: async args => use().renewSubscriptionClaimIfEnabled(row(args)),
    validateSubscriptionClaimIfEnabled: async args => use().validateSubscriptionClaimIfEnabled(row(args)),
    releaseSubscriptionClaim: async args => use().releaseSubscriptionClaim(row(args)),

    claimDocumentOwner: async args => use().claimDocumentOwner({ ...args, ...ids() }),
    releaseDocumentOwner: async args => use().releaseDocumentOwner({ ...args, ...ids() }),
    listDocumentOwners: async (args = {}) => use().listDocumentOwners({ ...args, ...ids() }),

    claimCoordinationLock: async args => use().claimCoordinationLock(args),
    renewCoordinationLock: async args => use().renewCoordinationLock(args),
    releaseCoordinationLock: async args => use().releaseCoordinationLock(args),

    claimDelivery: async args => use().claimDelivery(args),
    renewDeliveryClaim: async args => use().renewDeliveryClaim(args),
    completeDelivery: async args => use().completeDelivery(args),
    releaseDelivery: async args => use().releaseDelivery(args),
    getDelivery: async args => use().getDelivery(args),
  };

  return {
    scope,
    invalidate: () => {
      live = false;
    },
  };
}
