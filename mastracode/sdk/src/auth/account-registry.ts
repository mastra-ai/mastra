/**
 * Persistence-agnostic rules for a provider's account pool.
 *
 * A pool is the ordered list of accounts (OAuth subscriptions or API keys)
 * registered for one provider in one scope. These rules are shared by the
 * file-backed `AuthStorage` and by database-backed stores, so they work on
 * plain arrays and never read or write storage themselves:
 *
 * - ids are minted once and never derived from credentials;
 * - an added account that matches an existing entry's subscription identity
 *   (or exact credential) updates that entry instead of duplicating it;
 * - accounts are tried in priority order (lower first, ties by creation
 *   order), and rotation walks that order from the active entry, wrapping once;
 * - a new account goes to the end of that order;
 * - a non-empty pool has exactly one active entry;
 * - removing the active entry activates the next one.
 *
 * Callers pass entries in creation (insertion) order; the rules sort by
 * priority themselves, and the sort is stable, so equal priorities keep
 * creation order. No imports: this module is safe to load in a browser.
 */

export type PoolAccountType = 'oauth' | 'api-key';

export type PoolAccountStatus = 'ok' | 'cooldown' | 'auth-failed';

/** What a UI or API may show about a pool account. Never carries token material. */
export interface PoolAccountSummary {
  /** `${providerId}:${uuid}` */
  id: string;
  providerId: string;
  type: PoolAccountType;
  label: string;
  active: boolean;
  /** Switch order within the pool: lower is tried first; ties break by `createdAt`. */
  priority: number;
  status: PoolAccountStatus;
  /** Epoch ms when a cooldown ends; set only while `status` is `cooldown`. */
  cooldownUntil?: number;
  /** Epoch ms the account was added; breaks priority ties. */
  createdAt: number;
}

/** The fields the pool rules read from an entry. Stores carry their own extra fields. */
export interface PoolEntry {
  id: string;
  active: boolean;
  /** Stable subscription identity from the provider, when it exposes one. */
  identity?: string;
  /**
   * Switch order: lower is tried first. Entries written before priorities
   * existed may lack it until a store backfills it; they sort last, in
   * creation order.
   */
  priority?: number;
}

function priorityOf(entry: PoolEntry): number {
  return entry.priority ?? Number.POSITIVE_INFINITY;
}

/** Entries in switch order: by priority, ties keeping the given (creation) order. */
export function sortByPriority<T extends PoolEntry>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => {
    const pa = priorityOf(a);
    const pb = priorityOf(b);
    return pa === pb ? 0 : pa < pb ? -1 : 1;
  });
}

/** Priority for a newly added account: one past the pool's highest, so it goes last. */
export function nextPriority(entries: readonly PoolEntry[]): number {
  let max = -1;
  for (const entry of entries) {
    if (entry.priority !== undefined && entry.priority > max) max = entry.priority;
  }
  return max + 1;
}

/**
 * Priorities for entries that lack one, given in creation order: each gets
 * one past the pool's highest so far, so pools written before priorities
 * existed keep their insertion-order rotation. Returns only the entries that
 * changed.
 */
export function backfillPriorities<T extends PoolEntry>(entries: readonly T[]): T[] {
  let next = nextPriority(entries);
  return entries.filter(entry => entry.priority === undefined).map(entry => ({ ...entry, priority: next++ }));
}

/**
 * Reassign priorities so the pool switches in `orderedIds` order. Listed
 * entries get 0..n-1; entries left out follow them in their current switch
 * order. Returns only the entries whose priority changed, or undefined when
 * `orderedIds` names an entry outside the pool or names one twice.
 */
export function reorderAccounts<T extends PoolEntry>(
  entries: readonly T[],
  orderedIds: readonly string[],
): T[] | undefined {
  if (new Set(orderedIds).size !== orderedIds.length) return undefined;
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const listed: T[] = [];
  for (const id of orderedIds) {
    const entry = byId.get(id);
    if (!entry) return undefined;
    listed.push(entry);
  }
  const rest = sortByPriority(entries.filter(entry => !orderedIds.includes(entry.id)));
  return [...listed, ...rest]
    .map((entry, priority) => ({ entry, priority }))
    .filter(({ entry, priority }) => entry.priority !== priority)
    .map(({ entry, priority }) => ({ ...entry, priority }));
}

/** Mint an account id. Assigned once at creation and never derived from credentials. */
export function mintAccountId(providerId: string): string {
  return `${providerId}:${globalThis.crypto.randomUUID()}`;
}

/** Default label for the `position`-th account (1-based) of a provider. */
export function defaultAccountLabel(providerName: string, position: number): string {
  return `${providerName} account ${position}`;
}

/** What an incoming account is matched on when checking for an existing entry. */
export interface AccountMatch<T extends PoolEntry> {
  /** Stable subscription identity of the incoming credentials. */
  identity?: string;
  /** An id the incoming credentials map to under a store's older id scheme. */
  legacyId?: string;
  /** Whether an entry already holds exactly the incoming credentials. */
  sameCredential?: (entry: T) => boolean;
}

/** Whether `entry` is the same subscription as the incoming account, by any criterion. */
export function isSameSubscription<T extends PoolEntry>(entry: T, match: AccountMatch<T>): boolean {
  return (
    (match.identity !== undefined && entry.identity === match.identity) ||
    (match.legacyId !== undefined && entry.id === match.legacyId) ||
    match.sameCredential?.(entry) === true
  );
}

/**
 * The existing entry an incoming account should update, if any. Criteria are
 * tried in priority order across the whole pool: identity, then legacy id,
 * then identical credentials (the only signal an identity-less provider gives).
 */
export function findSameSubscription<T extends PoolEntry>(
  entries: readonly T[],
  match: AccountMatch<T>,
): T | undefined {
  const { sameCredential } = match;
  return (
    (match.identity !== undefined ? entries.find(entry => entry.identity === match.identity) : undefined) ??
    (match.legacyId !== undefined ? entries.find(entry => entry.id === match.legacyId) : undefined) ??
    (sameCredential ? entries.find(sameCredential) : undefined)
  );
}

/**
 * Accounts in rotation order: switch order (see {@link sortByPriority})
 * starting at the active entry and wrapping once. With no (or an unknown)
 * active id it is plain switch order.
 */
export function orderAccountsFromActive<T extends PoolEntry>(entries: readonly T[], activeId: string | undefined): T[] {
  const sorted = sortByPriority(entries);
  const index = activeId === undefined ? -1 : sorted.findIndex(entry => entry.id === activeId);
  if (index <= 0) return sorted;
  return [...sorted.slice(index), ...sorted.slice(0, index)];
}

/**
 * The entry to activate. With `instanceId`, that entry (undefined when it is
 * not in the pool). Without it, the entry after the active one in switch
 * order, wrapping once to the front — undefined when there is no other entry.
 */
export function selectActivationTarget<T extends PoolEntry>(entries: readonly T[], instanceId?: string): T | undefined {
  if (instanceId !== undefined) return entries.find(entry => entry.id === instanceId);
  if (entries.length <= 1) return undefined;
  const sorted = sortByPriority(entries);
  const currentIdx = sorted.findIndex(entry => entry.active);
  if (currentIdx < 0) return sorted[0];
  return sorted[(currentIdx + 1) % sorted.length];
}

export interface ActivationPlan<T extends PoolEntry> {
  /** The entry that becomes the only active one. */
  target: T;
  /** The previously active entry, when it is not the target. */
  previous?: T;
  /** Any further entries still marked active, which must be deactivated. */
  alsoActive: T[];
}

/** Plan an activation; see {@link selectActivationTarget} for how the target is chosen. */
export function planActivation<T extends PoolEntry>(
  entries: readonly T[],
  instanceId?: string,
): ActivationPlan<T> | undefined {
  const target = selectActivationTarget(entries, instanceId);
  if (!target) return undefined;
  const previous = entries.find(entry => entry.active && entry.id !== target.id);
  const alsoActive = entries.filter(entry => entry.active && entry.id !== target.id && entry.id !== previous?.id);
  return { target, previous, alsoActive };
}

export interface RemovalPlan<T extends PoolEntry> {
  removed: T;
  /** The entry that becomes active because the removed one was; absent when the pool is now empty or the removed one was inactive. */
  next?: T;
  /** Entries other than `next` still marked active, to deactivate when `next` is set. */
  alsoActive: T[];
}

/**
 * Plan removing an entry. When the removed entry was active, the entry after
 * it in switch order becomes active (or the first remaining one when it was
 * last). Undefined when `instanceId` is not in the pool.
 */
export function planRemoval<T extends PoolEntry>(
  entries: readonly T[],
  instanceId: string,
): RemovalPlan<T> | undefined {
  const removed = entries.find(entry => entry.id === instanceId);
  if (!removed) return undefined;
  if (!removed.active) return { removed, alsoActive: [] };
  const sorted = sortByPriority(entries);
  const idx = sorted.indexOf(removed);
  const next = sorted[idx + 1] ?? sorted.find(entry => entry.id !== instanceId);
  const alsoActive = next
    ? entries.filter(entry => entry.active && entry.id !== next.id && entry.id !== instanceId)
    : [];
  return { removed, next, alsoActive };
}

/** The renamed copy of the entry, or undefined when `instanceId` is not in the pool. */
export function renameAccount<T extends PoolEntry & { label: string }>(
  entries: readonly T[],
  instanceId: string,
  label: string,
): T | undefined {
  const entry = entries.find(candidate => candidate.id === instanceId);
  return entry ? { ...entry, label } : undefined;
}
