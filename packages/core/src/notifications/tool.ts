import { z } from 'zod/v4';
import { createTool } from '../tools';
import type { ToolExecutionContext } from '../tools';
import { createNotificationSignal } from './signals';
import type { NotificationsStorage } from './storage';
import type { NotificationRecord, NotificationStatus } from './types';

const notificationActionSchema = z
  .object({
    action: z.enum(['list', 'read', 'markSeen', 'dismiss', 'archive', 'search']),
    threadId: z.string().optional(),
    id: z.string().optional(),
    status: z.enum(['pending', 'delivered', 'seen', 'dismissed', 'archived', 'discarded', 'failed']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    source: z.string().optional(),
    query: z.string().optional(),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum records to return. Defaults to 20; the response reports hasMore when more remain.'),
  })
  .superRefine((input, ctx) => {
    if (input.action === 'search' && !input.query?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['query'], message: 'notification-inbox search requires query' });
    }
    if (
      (input.action === 'markSeen' || input.action === 'dismiss' || input.action === 'archive') &&
      !input.id?.trim()
    ) {
      ctx.addIssue({ code: 'custom', path: ['id'], message: `notification-inbox ${input.action} requires id` });
    }
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

const DEFAULT_LIST_LIMIT = 20;

/**
 * Agent-facing projection for list/search results. `metadata` and `payload` are internal
 * bookkeeping (content hashes, raw source payloads) that can be several KB per record and
 * dominate the token cost of an inbox listing.
 */
const toInboxProjection = (notification: NotificationRecord) => {
  const { metadata: _metadata, payload: _payload, ...projection } = notification;
  return projection;
};

/**
 * Viewing a notification marks it as seen: any pending/delivered notification returned to
 * the agent transitions to 'seen' so the pending backlog drains as the agent triages it.
 * Without this, summarized notifications stayed 'pending' forever (the summary digest is
 * consumed without any per-record transition) and every list returned the full backlog.
 * Returns the ids of the records whose status write succeeded; a failed write leaves the
 * page readable with its stored statuses rather than failing the whole listing.
 */
async function markViewedNotificationsSeen({
  threadId,
  notifications,
  storage,
}: {
  threadId: string;
  notifications: NotificationRecord[];
  storage: NotificationsStorage;
}): Promise<Set<string>> {
  const ids = notifications.filter(isReadable).map(notification => notification.id);
  if (ids.length === 0) return new Set();
  try {
    const updated = await storage.updateNotificationsStatus({ threadId, ids, status: 'seen' });
    return new Set(updated.map(notification => notification.id));
  } catch {
    return new Set();
  }
}

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
      // No agent/resourceId to deliver through and no prior signal: the content never reached
      // the agent, so leave it pending rather than silently consuming it.
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
      'Inspect and manage the current thread notification inbox. Use this to list unread notifications, read full details after a summary, mark notifications seen, dismiss, archive, or search old notifications. Listing, reading, or searching automatically marks the returned unread notifications as seen; list defaults to unread notifications unless a status is given.',
    inputSchema: notificationActionSchema,
    execute: async (input: NotificationInboxAction, context) => {
      const threadId = input.threadId ?? context?.agent?.threadId;
      if (!threadId) {
        throw new Error('notification-inbox requires a threadId');
      }

      if (input.action === 'list' || input.action === 'search') {
        // Fetch one past the page so the response can report whether the inbox has more.
        const limit = input.limit ?? DEFAULT_LIST_LIMIT;
        const notifications = await storage.listNotifications({
          threadId,
          // Default list to unread: auto-seen bumps updatedAt (the sort key), so listing every
          // status would keep returning the page just viewed. Search spans all statuses.
          status: input.status ?? (input.action === 'list' ? ['pending', 'delivered'] : undefined),
          priority: input.priority,
          source: input.source,
          ...(input.action === 'search' ? { search: input.query! } : {}),
          limit: limit + 1,
        });
        const page = notifications.slice(0, limit);
        const seenIds = await markViewedNotificationsSeen({ threadId, notifications: page, storage });
        return {
          notifications: page.map(notification =>
            seenIds.has(notification.id)
              ? { ...toInboxProjection(notification), status: 'seen' as const }
              : toInboxProjection(notification),
          ),
          hasMore: notifications.length > limit,
          markedSeen: seenIds.size,
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
              limit: input.limit ?? DEFAULT_LIST_LIMIT,
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

      const statusByAction = {
        markSeen: 'seen',
        dismiss: 'dismissed',
        archive: 'archived',
      } satisfies Record<'markSeen' | 'dismiss' | 'archive', NotificationStatus>;

      return {
        notification: await storage.updateNotification({
          threadId,
          // The schema refine guarantees id for these actions; superRefine does not narrow the type.
          id: input.id!,
          status: statusByAction[input.action],
        }),
      };
    },
  });
}
