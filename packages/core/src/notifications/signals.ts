import { createSignal } from '../agent/signals';
import type { AgentSignalAttributes, CreatedAgentSignal } from '../agent/signals';
import type { NotificationRecord, NotificationSummary } from './types';

export function notificationSignalAttributes(notification: NotificationRecord): AgentSignalAttributes {
  return {
    ...notification.attributes,
    id: notification.id,
    source: notification.source,
    type: notification.kind,
    kind: notification.kind,
    priority: notification.priority,
    status: notification.status,
    ...(notification.coalescedCount && notification.coalescedCount > 1
      ? { coalescedCount: notification.coalescedCount }
      : {}),
  };
}

export function notificationSummaryContents(summary: NotificationSummary): string {
  const sources = Object.entries(summary.bySource)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([source, count]) => `${source}: ${count}`)
    .join(', ');
  return sources || 'No pending notifications';
}

export function createNotificationSignal(notification: NotificationRecord): CreatedAgentSignal {
  return createSignal({
    type: 'notification',
    tagName: 'notification',
    contents: notification.summary,
    attributes: notificationSignalAttributes(notification),
    metadata: { notification },
  });
}

export function createNotificationSummarySignal(summary: NotificationSummary): CreatedAgentSignal {
  return createSignal({
    type: 'notification',
    tagName: 'notification-summary',
    contents: notificationSummaryContents(summary),
    attributes: {
      pending: summary.pending,
    },
    metadata: { notificationSummary: summary, notificationIds: summary.notificationIds },
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
      resourceId: notifications[0]?.resourceId,
      agentId: notifications[0]?.agentId,
      pending: 0,
      bySource: {},
      byPriority: {},
      notificationIds: [],
    },
  );
}
