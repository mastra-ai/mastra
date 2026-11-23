// Internal helpers shared by the dispatcher and the in-memory store. Not re-exported
// from `@mastra/core/notifications`.
import type { NotificationRecord } from './types';

/** When a record next becomes due, or Infinity when it has no due time at all. */
export const notificationDueTime = (record: NotificationRecord): number => {
  const deliverAt = record.deliverAt?.getTime();
  const summaryAt = record.summaryAt?.getTime();
  if (deliverAt !== undefined && summaryAt !== undefined) return Math.min(deliverAt, summaryAt);
  return deliverAt ?? summaryAt ?? Number.POSITIVE_INFINITY;
};

/**
 * Whether a record still occupies the due list at `now`. A record a dispatch pass
 * summarized but that keeps its `deliverAt` stays due for the full delivery.
 */
export const isNotificationDue = (record: NotificationRecord, now: Date): boolean =>
  record.status === 'pending' && notificationDueTime(record) <= now.getTime();
