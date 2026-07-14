import { z } from 'zod/v4';
import type { Schedule } from '../storage/domains/schedules/base';
import { createStep, createWorkflow } from '../workflows/evented';
import { computeNextFireAt } from '../workflows/scheduler';
import { dispatchDueNotifications } from './dispatcher';

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

export type NotificationDispatchConfig = {
  /** Defaults to true. Set false to opt out of automatic scheduled dispatch. */
  enabled?: boolean;
  cron?: string;
  batchSize?: number;
};

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
  })
    .then(dispatchStep)
    .commit();
}
