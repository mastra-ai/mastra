import { z } from 'zod';
import { createTool } from '../tools';
import type { NotificationsStorage } from './storage';
import type { ListNotificationsInput, NotificationStatus } from './types';

const notificationActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list'),
    threadId: z.string().optional(),
    status: z.enum(['pending', 'delivered', 'seen', 'dismissed', 'archived', 'discarded']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    source: z.string().optional(),
    limit: z.number().int().positive().optional(),
  }),
  z.object({ action: z.literal('read'), id: z.string(), threadId: z.string().optional() }),
  z.object({ action: z.literal('markSeen'), id: z.string(), threadId: z.string().optional() }),
  z.object({ action: z.literal('dismiss'), id: z.string(), threadId: z.string().optional() }),
  z.object({ action: z.literal('archive'), id: z.string(), threadId: z.string().optional() }),
  z.object({
    action: z.literal('search'),
    threadId: z.string().optional(),
    query: z.string(),
    limit: z.number().int().positive().optional(),
  }),
]);

type NotificationInboxAction = z.infer<typeof notificationActionSchema>;

export function createNotificationInboxTool({ storage }: { storage: NotificationsStorage }) {
  return createTool({
    id: 'notification-inbox',
    description:
      'Inspect and manage the current thread notification inbox. Use this to list pending notifications, read full details after a summary, mark notifications seen, dismiss, archive, or search old notifications.',
    inputSchema: notificationActionSchema,
    execute: async (input: NotificationInboxAction, context) => {
      const threadId = input.threadId ?? context?.agent?.threadId;
      if (!threadId) {
        throw new Error('notification-inbox requires a threadId');
      }

      if (input.action === 'list') {
        const listInput: ListNotificationsInput = {
          threadId,
          status: input.status,
          priority: input.priority,
          source: input.source,
          limit: input.limit,
        };
        return { notifications: await storage.listNotifications(listInput) };
      }

      if (input.action === 'search') {
        return {
          notifications: await storage.listNotifications({ threadId, search: input.query, limit: input.limit }),
        };
      }

      if (input.action === 'read') {
        const notification = await storage.getNotification({ threadId, id: input.id });
        if (!notification) throw new Error(`Notification ${input.id} was not found for thread ${threadId}`);
        if (notification.status === 'pending' || notification.status === 'delivered') {
          return { notification: await storage.updateNotification({ threadId, id: input.id, status: 'seen' }) };
        }
        return { notification };
      }

      const statusByAction = {
        markSeen: 'seen',
        dismiss: 'dismissed',
        archive: 'archived',
      } satisfies Record<'markSeen' | 'dismiss' | 'archive', NotificationStatus>;

      return {
        notification: await storage.updateNotification({
          threadId,
          id: input.id,
          status: statusByAction[input.action],
        }),
      };
    },
  });
}
