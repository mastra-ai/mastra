import { createSignal } from '../agent/signals';
import type { CreatedAgentSignal } from '../agent/signals';
import type { NotificationRecord, NotificationSummary } from './types';

export function createNotificationSignal(notification: NotificationRecord): CreatedAgentSignal {
  return createSignal({
    type: 'notification',
    tagName: 'notification',
    contents: notification.summary,
    attributes: {
      id: notification.id,
      source: notification.source,
      type: notification.kind,
      priority: notification.priority,
      status: notification.status,
    },
    metadata: { notification },
  });
}

export function createNotificationSummarySignal(summary: NotificationSummary): CreatedAgentSignal {
  return createSignal({
    type: 'notification',
    tagName: 'notification-summary',
    contents: Object.entries(summary.bySource)
      .map(([source, count]) => `${source}: ${count}`)
      .join(', '),
    attributes: {
      pending: summary.pending,
    },
    metadata: { notificationSummary: summary },
  });
}

export function summarizeNotifications(notifications: NotificationRecord[]): NotificationSummary {
  return notifications.reduce<NotificationSummary>(
    (summary, notification) => {
      summary.pending += notification.status === 'pending' ? 1 : 0;
      summary.bySource[notification.source] = (summary.bySource[notification.source] ?? 0) + 1;
      summary.byPriority[notification.priority] = (summary.byPriority[notification.priority] ?? 0) + 1;
      summary.notificationIds.push(notification.id);
      return summary;
    },
    {
      threadId: notifications[0]?.threadId ?? '',
      pending: 0,
      bySource: {},
      byPriority: {},
      notificationIds: [],
    },
  );
}
