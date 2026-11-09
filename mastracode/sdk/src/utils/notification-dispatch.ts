import { AsyncLocalStorage } from 'node:async_hooks';

import type { LeaseProvider } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import { dispatchDueNotifications } from '@mastra/core/notifications';

import { notificationDispatchLeaseKey } from './signals-pubsub.js';

const DEFAULT_INTERVAL_MS = 10_000;
const DEFAULT_LEASE_TTL_MS = 60_000;

/**
 * The resource the current async context is dispatching notifications for,
 * and which of its dispatch leases this pass holds.
 */
const dispatching = new AsyncLocalStorage<{
  resourceId: string;
  /** The resource's own lease: its threads that carry no scope. */
  unscoped: boolean;
  /** The thread scopes whose leases this pass holds. */
  scopes: ReadonlySet<string>;
}>();

/**
 * Whether this call runs inside this process's own dispatch pass for
 * `resourceId`, holding the lease for threads of `scope` (or with no `scope`,
 * for threads that carry none), as opposed to the dispatch schedule every
 * process sharing the database takes turns running.
 */
export function isDispatchingNotificationsFor(resourceId: string, scope?: string): boolean {
  const pass = dispatching.getStore();
  if (pass?.resourceId !== resourceId) return false;
  return scope === undefined ? pass.unscoped : pass.scopes.has(scope);
}

/**
 * Whether a delivery-time policy should leave a due notification pending
 * (`hold`). Deliveries happen from this process's own dispatch pass for the
 * record's resource, under the lease that covers the record's thread. Anything
 * else holds: a thread no session here owns belongs to another process sharing
 * the database, and once this process's dispatcher runs, its own resources are
 * delivered by whichever process holds their dispatch lease, never by the
 * shared dispatch schedule.
 */
export function shouldHoldNotificationDelivery({
  resourceId,
  scope,
  ownedHere,
  dispatcher,
}: {
  resourceId: string;
  /** The thread's scope (`WakeSession.scope`), unset for a thread that carries none. */
  scope?: string;
  /** Whether a session in this process owns the resource. */
  ownedHere: boolean;
  dispatcher: { readonly running: boolean };
}): boolean {
  if (isDispatchingNotificationsFor(resourceId, scope)) return false;
  return !ownedHere || dispatcher.running;
}

type SessionScope = { resourceId: string; scope?: string };

export type ResourceNotificationDispatcherOptions = {
  getMastra: () => Mastra | undefined;
  /**
   * The resources this process runs sessions for, each with the thread scope
   * (`threadScopeKey`) of a session serving it, unset when it has none.
   */
  getSessionScopes: () => Iterable<SessionScope> | Promise<Iterable<SessionScope>>;
  /**
   * Cross-process leases. When set, a resource's notifications are dispatched
   * only by the processes holding its dispatch leases, so two processes
   * serving the same resource never both deliver one: the threads of each
   * scope (each project, for processes in different directories) go to the
   * process holding that scope's lease, and threads with no scope to the one
   * holding the resource's own.
   */
  leases?: LeaseProvider;
  /** Unique to this process. */
  owner: string;
  intervalMs?: number;
  leaseTtlMs?: number;
  onError?: (error: unknown) => void;
};

/**
 * Delivers the due notifications of the resources this process serves, on a
 * timer of its own.
 *
 * Every Mastra Code process shares one database, so one notification store and
 * one dispatch schedule, and the scheduler gives each fire to whichever process
 * claims it first, usually the same one for as long as it runs. That process
 * cannot run another project's thread, so its delivery policy holds those
 * records. Each process therefore dispatches its own resources here.
 */
export function createResourceNotificationDispatcher(options: ResourceNotificationDispatcherOptions) {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const leaseTtlMs = options.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS;
  /** The dispatch lease keys this process holds. */
  const held = new Set<string>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let ticking: Promise<void> | undefined;

  const release = async (key: string) => {
    held.delete(key);
    await options.leases?.releaseLease(key, options.owner).catch(options.onError);
  };

  const claim = async (key: string): Promise<boolean> => {
    if (!options.leases) return true;
    try {
      // Acquiring a lease this process already holds renews it.
      const { acquired } = await options.leases.acquireLease(key, options.owner, leaseTtlMs);
      if (acquired) held.add(key);
      else held.delete(key);
      return acquired;
    } catch (error) {
      options.onError?.(error);
      return false;
    }
  };

  const runTick = async () => {
    const mastra = options.getMastra();
    const storage = await mastra?.getStorage()?.getStore('notifications');
    if (!mastra || !storage) return;
    const scopesByResource = new Map<string, Set<string>>();
    for (const { resourceId, scope } of await options.getSessionScopes()) {
      const scopes = scopesByResource.get(resourceId) ?? new Set<string>();
      if (scope !== undefined) scopes.add(scope);
      scopesByResource.set(resourceId, scopes);
    }
    const wanted = new Set(
      [...scopesByResource].flatMap(([resourceId, scopes]) => [
        notificationDispatchLeaseKey(resourceId),
        ...[...scopes].map(scope => notificationDispatchLeaseKey(resourceId, scope)),
      ]),
    );
    for (const key of [...held]) {
      if (!wanted.has(key)) await release(key);
    }
    for (const [resourceId, scopes] of scopesByResource) {
      if (!timer) continue;
      const unscoped = await claim(notificationDispatchLeaseKey(resourceId));
      const heldScopes = new Set<string>();
      for (const scope of scopes) {
        if (await claim(notificationDispatchLeaseKey(resourceId, scope))) heldScopes.add(scope);
      }
      if (!unscoped && heldScopes.size === 0) continue;
      try {
        await dispatching.run({ resourceId, unscoped, scopes: heldScopes }, () =>
          dispatchDueNotifications({ mastra, storage, resourceId }),
        );
      } catch (error) {
        options.onError?.(error);
      }
    }
  };

  const tick = (): Promise<void> => {
    // Ticks run from a timer, so a failure must be reported, never left as an unhandled rejection.
    ticking ??= runTick()
      .catch(error => options.onError?.(error))
      .finally(() => {
        ticking = undefined;
      });
    return ticking;
  };

  return {
    get running(): boolean {
      return timer !== undefined;
    },
    start(): void {
      if (timer) return;
      timer = setInterval(() => void tick(), intervalMs);
      timer.unref?.();
      void tick();
    },
    async stop(): Promise<void> {
      if (timer) clearInterval(timer);
      timer = undefined;
      await ticking;
      await Promise.all([...held].map(release));
    },
    /** Runs one dispatch pass now. Only dispatches while started. */
    tick,
  };
}

export type ResourceNotificationDispatcher = ReturnType<typeof createResourceNotificationDispatcher>;
