import { AsyncLocalStorage } from 'node:async_hooks';

import type { LeaseProvider } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import { dispatchDueNotifications } from '@mastra/core/notifications';

import { notificationDispatchLeaseKey } from './signals-pubsub.js';

const DEFAULT_INTERVAL_MS = 10_000;
const DEFAULT_LEASE_TTL_MS = 60_000;

/** The resource whose notifications the current async context is dispatching. */
const dispatchingFor = new AsyncLocalStorage<string>();

/**
 * Whether this call runs inside this process's own dispatch pass for
 * `resourceId`, as opposed to the dispatch schedule every process sharing the
 * database takes turns running.
 */
export function isDispatchingNotificationsFor(resourceId: string): boolean {
  return dispatchingFor.getStore() === resourceId;
}

/**
 * Whether a delivery-time policy should leave a due notification pending
 * (`hold`). Deliveries happen from this process's own dispatch pass for the
 * record's resource. Anything else holds: a thread no session here owns
 * belongs to another process sharing the database, and once this process's
 * dispatcher runs, its own resources are delivered by whichever process holds
 * their dispatch lease, never by the shared dispatch schedule.
 */
export function shouldHoldNotificationDelivery({
  resourceId,
  ownedHere,
  dispatcher,
}: {
  resourceId: string;
  /** Whether a session in this process owns the resource. */
  ownedHere: boolean;
  dispatcher: { readonly running: boolean };
}): boolean {
  if (isDispatchingNotificationsFor(resourceId)) return false;
  return !ownedHere || dispatcher.running;
}

export type ResourceNotificationDispatcherOptions = {
  getMastra: () => Mastra | undefined;
  /** The resources this process runs sessions for. */
  getResourceIds: () => Iterable<string>;
  /**
   * Cross-process leases. When set, a resource's notifications are dispatched
   * only by the process holding its dispatch lease, so two processes serving
   * the same resource (worktrees of one repo) never both deliver them.
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
  const held = new Set<string>();
  let timer: ReturnType<typeof setInterval> | undefined;
  let ticking: Promise<void> | undefined;

  const release = async (resourceId: string) => {
    held.delete(resourceId);
    await options.leases?.releaseLease(notificationDispatchLeaseKey(resourceId), options.owner).catch(options.onError);
  };

  const claim = async (resourceId: string): Promise<boolean> => {
    if (!options.leases) return true;
    try {
      // Acquiring a lease this process already holds renews it.
      const { acquired } = await options.leases.acquireLease(
        notificationDispatchLeaseKey(resourceId),
        options.owner,
        leaseTtlMs,
      );
      if (acquired) held.add(resourceId);
      else held.delete(resourceId);
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
    const resourceIds = new Set(options.getResourceIds());
    for (const resourceId of [...held]) {
      if (!resourceIds.has(resourceId)) await release(resourceId);
    }
    for (const resourceId of resourceIds) {
      if (!timer || !(await claim(resourceId))) continue;
      try {
        await dispatchingFor.run(resourceId, () => dispatchDueNotifications({ mastra, storage, resourceId }));
      } catch (error) {
        options.onError?.(error);
      }
    }
  };

  const tick = (): Promise<void> => {
    ticking ??= runTick().finally(() => {
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
