import { z } from 'zod/v4';
import type { Schedule } from '../storage/domains/schedules/base';
import { createStep, createWorkflow } from '../workflows/evented';
import { computeNextFireAt } from '../workflows/scheduler';
import { dispatchDueNotifications } from './dispatcher';
import type { NotificationsStorage } from './storage';

export const NOTIFICATION_DISPATCH_WORKFLOW_ID = '__mastra_notification_dispatcher';

/**
 * Schedule row id for the lazily-created dispatcher schedule. Deliberately
 * NOT `wf_`-prefixed: `registerDeclarativeSchedules` orphan-cleanup deletes
 * `wf_`-prefixed rows that are no longer declared in code, and this row is
 * created imperatively (like heartbeat rows) on first deferred notification.
 */
export const NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID = '__mastra_notification_dispatch';

export const NOTIFICATION_DISPATCH_DEFAULT_CRON = '*/1 * * * *';
export const NOTIFICATION_DISPATCH_DEFAULT_BATCH_SIZE = 100;

/**
 * The dispatcher ticks once a minute, has a single non-suspending step, and is
 * never resumed — no code path consumes its snapshot. Opting out of snapshot
 * persistence entirely keeps `mastra_workflow_snapshot` from growing by one
 * dead row per minute forever (issue #20254).
 */
const NOTIFICATION_DISPATCH_SHOULD_PERSIST_SNAPSHOT = () => false;

export type NotificationDispatchConfig = {
  /** Defaults to true. Set false to opt out of automatic scheduled dispatch. */
  enabled?: boolean;
  cron?: string;
  batchSize?: number;
};

/**
 * Upper bound passed as `now` to find every pending record with a due time,
 * however far ahead. Year 9999 stays inside every adapter's timestamp range.
 */
const FAR_FUTURE = new Date('9999-12-31T23:59:59.999Z');

/**
 * True when some pending notification has a `deliverAt` or `summaryAt`, i.e.
 * the dispatcher still has work now or later. Records without a due time are
 * never picked up by a dispatch pass, so they don't count.
 */
export async function hasPendingDeferredNotifications(storage: NotificationsStorage): Promise<boolean> {
  const pending = await storage.listDueNotifications({ now: FAR_FUTURE, limit: 1 });
  return pending.length > 0;
}

export function parseNotificationDispatchNow(input?: string): Date {
  const now = input ? new Date(input) : new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid notification dispatch time: ${input}`);
  }
  return now;
}

/**
 * Builds the imperative schedule row that drives the notification dispatcher.
 * Created lazily by `Mastra.__ensureNotificationDispatchReady()` on the first
 * deferred notification, rather than declared on the workflow, so idle apps
 * never start the scheduler.
 */
export function buildNotificationDispatchSchedule({
  cron = NOTIFICATION_DISPATCH_DEFAULT_CRON,
  batchSize = NOTIFICATION_DISPATCH_DEFAULT_BATCH_SIZE,
}: Omit<NotificationDispatchConfig, 'enabled'> = {}): Schedule {
  const now = Date.now();
  return {
    id: NOTIFICATION_DISPATCH_SCHEDULE_ROW_ID,
    target: {
      type: 'workflow',
      workflowId: NOTIFICATION_DISPATCH_WORKFLOW_ID,
      inputData: { limit: batchSize },
    },
    cron,
    status: 'active',
    nextFireAt: computeNextFireAt(cron, { after: now }),
    createdAt: now,
    updatedAt: now,
    metadata: { internal: true, feature: 'notifications' },
  };
}

export function createNotificationDispatchWorkflow({
  batchSize = NOTIFICATION_DISPATCH_DEFAULT_BATCH_SIZE,
}: Omit<NotificationDispatchConfig, 'enabled' | 'cron'> = {}) {
  const dispatchStep = createStep({
    id: 'dispatch-due-notifications',
    inputSchema: z.object({
      now: z.string().optional(),
      limit: z.number().optional(),
    }),
    outputSchema: z.object({
      delivered: z.number(),
      failed: z.number(),
    }),
    execute: async ({ inputData, mastra }) => {
      const storage = await mastra.getStorage()?.getStore('notifications');
      if (!storage) {
        return { delivered: 0, failed: 0 };
      }

      const now = parseNotificationDispatchNow(inputData.now);

      const result = await dispatchDueNotifications({
        mastra,
        storage,
        now,
        limit: inputData.limit ?? batchSize,
      });

      // Stop the once-a-minute cron when nothing is left to deliver, so an
      // idle app stops polling storage. The next deferral re-arms it.
      await mastra.__releaseNotificationDispatchIfIdle();

      return { delivered: result.delivered.length, failed: result.failed.length };
    },
  });

  return createWorkflow({
    id: NOTIFICATION_DISPATCH_WORKFLOW_ID,
    inputSchema: z.object({
      now: z.string().optional(),
      limit: z.number().optional(),
    }),
    outputSchema: z.object({
      delivered: z.number(),
      failed: z.number(),
    }),
    options: {
      shouldPersistSnapshot: NOTIFICATION_DISPATCH_SHOULD_PERSIST_SNAPSHOT,
    },
  })
    .then(dispatchStep)
    .commit();
}
