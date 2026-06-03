import { z } from 'zod/v4';
import { createStep, createWorkflow } from '../workflows/evented';
import { dispatchDueNotifications } from './dispatcher';

export const NOTIFICATION_DISPATCH_WORKFLOW_ID = '__mastra_notification_dispatcher';
export const NOTIFICATION_DISPATCH_SCHEDULE_ID = 'dispatch';

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

export function createNotificationDispatchWorkflow({
  cron = '*/1 * * * *',
  batchSize = 100,
}: Omit<NotificationDispatchConfig, 'enabled'> = {}) {
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
    schedule: {
      id: NOTIFICATION_DISPATCH_SCHEDULE_ID,
      cron,
      inputData: { limit: batchSize },
      metadata: { internal: true, feature: 'notifications' },
    },
  })
    .then(dispatchStep)
    .commit();
}
