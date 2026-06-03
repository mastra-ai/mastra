import { z } from 'zod/v4';
import { createTool } from '../tools';
import type { ToolExecutionContext } from '../tools';
import { createNotificationSignal } from './signals';
import type { NotificationsStorage } from './storage';
import type { ListNotificationsInput, NotificationRecord, NotificationStatus } from './types';

const notificationActionSchema = z.object({
  action: z.enum(['list', 'read', 'markSeen', 'dismiss', 'archive', 'search']),
  threadId: z.string().optional(),
  id: z.string().optional(),
  status: z.enum(['pending', 'delivered', 'seen', 'dismissed', 'archived', 'discarded']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  source: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

type NotificationInboxAction = z.infer<typeof notificationActionSchema>;

type NotificationToolAgent = {
  sendSignal: (
    signal: ReturnType<typeof createNotificationSignal>,
    target: { resourceId: string; threadId: string },
  ) => { signal: ReturnType<typeof createNotificationSignal>; persisted?: Promise<void> };
};

const isReadable = (notification: NotificationRecord) =>
  notification.status === 'pending' || notification.status === 'delivered';

async function deliverNotifications({
  notifications,
  storage,
  context,
}: {
  notifications: NotificationRecord[];
  storage: NotificationsStorage;
  context: ToolExecutionContext;
}) {
  let delivered = 0;
  let markedSeen = 0;
  let unavailable = 0;
  let alreadyRead = 0;

  for (const notification of notifications) {
    if (!isReadable(notification)) {
      alreadyRead += 1;
      continue;
    }

    const agentId = notification.agentId ?? context?.agent?.agentId;
    const resourceId = notification.resourceId ?? context?.agent?.resourceId;
    const mastra = context?.mastra;
    const agent =
      agentId && typeof mastra?.getAgentById === 'function' ? await mastra.getAgentById(agentId) : undefined;

    if (agent && resourceId && !notification.deliveredSignalId) {
      const signal = createNotificationSignal({ ...notification, status: 'delivered' });
      const result = (agent as NotificationToolAgent).sendSignal(signal, {
        resourceId,
        threadId: notification.threadId,
      });
      await result.persisted;
      await storage.updateNotification({
        threadId: notification.threadId,
        id: notification.id,
        status: 'seen',
        deliveredSignalId: result.signal.id,
      });
      delivered += 1;
      continue;
    }

    if (notification.deliveredSignalId) {
      await storage.updateNotification({ threadId: notification.threadId, id: notification.id, status: 'seen' });
      markedSeen += 1;
    } else {
      unavailable += 1;
    }
  }

  const message =
    delivered > 0
      ? `${delivered} notification${delivered === 1 ? '' : 's'} will now be delivered.`
      : 'No unread notifications needed delivery.';

  return { message, delivered, markedSeen, unavailable, alreadyRead };
}

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
        if (!input.query) throw new Error('notification-inbox search requires query');
        return {
          notifications: await storage.listNotifications({
            threadId,
            search: input.query,
            status: input.status,
            priority: input.priority,
            source: input.source,
            limit: input.limit,
          }),
        };
      }

      if (input.action === 'read') {
        const notifications = input.id
          ? [await storage.getNotification({ threadId, id: input.id })]
          : await storage.listNotifications({
              threadId,
              status: input.status ?? ['pending', 'delivered'],
              priority: input.priority,
              source: input.source,
              limit: input.limit,
            });
        if (input.id && !notifications[0])
          throw new Error(`Notification ${input.id} was not found for thread ${threadId}`);
        return deliverNotifications({
          notifications: notifications.filter((notification): notification is NotificationRecord =>
            Boolean(notification),
          ),
          storage,
          context,
        });
      }

      if (!input.id) throw new Error(`notification-inbox ${input.action} requires id`);
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
