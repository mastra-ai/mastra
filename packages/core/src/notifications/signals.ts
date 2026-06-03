import { createSignal } from '../agent/signals';
import type { AgentSignalAttributes, CreatedAgentSignal } from '../agent/signals';
import type {
  NotificationPriority,
  NotificationRecord,
  NotificationSignalMetadata,
  NotificationSummary,
  NotificationSummarySignalMetadata,
} from './types';

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

const priorityOrder: NotificationPriority[] = ['low', 'medium', 'high', 'urgent'];

function highestPriority(byPriority: Partial<Record<NotificationPriority, number>>): NotificationPriority | undefined {
  for (let i = priorityOrder.length - 1; i >= 0; i -= 1) {
    const priority = priorityOrder[i];
    if (priority && (byPriority[priority] ?? 0) > 0) return priority;
  }
  return undefined;
}

export function notificationSignalMetadata(notification: NotificationRecord): NotificationSignalMetadata {
  return {
    signal: 'notification',
    recordId: notification.id,
    source: notification.source,
    kind: notification.kind,
    priority: notification.priority,
    status: notification.status,
    ...(notification.coalescedCount && notification.coalescedCount > 1
      ? { coalescedCount: notification.coalescedCount }
      : {}),
    ...(notification.deliveredAt ? { deliveredAt: notification.deliveredAt.toISOString() } : {}),
    ...(notification.seenAt ? { seenAt: notification.seenAt.toISOString() } : {}),
  };
}

export function notificationSummarySignalMetadata(summary: NotificationSummary): NotificationSummarySignalMetadata {
  const priority = highestPriority(summary.byPriority);
  return {
    signal: 'summary',
    pending: summary.pending,
    groups: Object.entries(summary.bySource)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([source, count]) => ({ source, count })),
    byPriority: summary.byPriority,
    notificationIds: summary.notificationIds,
    ...(priority ? { priority } : {}),
  };
}

export function createNotificationSignal(notification: NotificationRecord): CreatedAgentSignal {
  return createSignal({
    type: 'notification',
    tagName: 'notification',
    contents: notification.summary,
    attributes: notificationSignalAttributes(notification),
    metadata: { ...notification.metadata, notification: notificationSignalMetadata(notification) },
  });
}

export function createNotificationSummarySignal(summary: NotificationSummary): CreatedAgentSignal {
  const notification = notificationSummarySignalMetadata(summary);
  return createSignal({
    type: 'notification',
    tagName: 'notification-summary',
    contents: notificationSummaryContents(summary),
    attributes: {
      pending: summary.pending,
      ...(notification.priority ? { priority: notification.priority } : {}),
    },
    metadata: { notification, notificationSummary: summary, notificationIds: summary.notificationIds },
  });
}

export function summarizeNotifications(notifications: NotificationRecord[]): NotificationSummary {
  const pendingNotifications = notifications.filter(notification => notification.status === 'pending');
  const first = pendingNotifications[0] ?? notifications[0];
  return pendingNotifications.reduce<NotificationSummary>(
    (summary, notification) => {
      summary.pending += 1;
      summary.bySource[notification.source] = (summary.bySource[notification.source] ?? 0) + 1;
      summary.byPriority[notification.priority] = (summary.byPriority[notification.priority] ?? 0) + 1;
      summary.notificationIds.push(notification.id);
      return summary;
    },
    {
      threadId: first?.threadId ?? '',
      resourceId: first?.resourceId,
      agentId: first?.agentId,
      pending: 0,
      bySource: {},
      byPriority: {},
      notificationIds: [],
    },
  );
}
