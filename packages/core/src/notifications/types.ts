export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type NotificationStatus = 'pending' | 'delivered' | 'seen' | 'dismissed' | 'archived';

export type NotificationRecord = {
  id: string;
  threadId: string;
  source: string;
  kind: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  summary: string;
  payload?: unknown;
  resourceId?: string;
  agentId?: string;
  sourceId?: string;
  dedupeKey?: string;
  coalesceKey?: string;
  coalescedCount?: number;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
  seenAt?: Date;
  dismissedAt?: Date;
  archivedAt?: Date;
  metadata?: Record<string, unknown>;
};

export type CreateNotificationInput = {
  id?: string;
  threadId: string;
  source: string;
  kind: string;
  priority?: NotificationPriority;
  summary: string;
  payload?: unknown;
  resourceId?: string;
  agentId?: string;
  sourceId?: string;
  dedupeKey?: string;
  coalesceKey?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

export type ListNotificationsInput = {
  threadId: string;
  status?: NotificationStatus | NotificationStatus[];
  priority?: NotificationPriority | NotificationPriority[];
  source?: string;
  resourceId?: string;
  agentId?: string;
  search?: string;
  limit?: number;
};

export type UpdateNotificationInput = {
  id: string;
  threadId: string;
  status?: NotificationStatus;
  summary?: string;
  payload?: unknown;
  metadata?: Record<string, unknown>;
};

export type NotificationSummary = {
  threadId: string;
  pending: number;
  bySource: Record<string, number>;
  byPriority: Partial<Record<NotificationPriority, number>>;
  notificationIds: string[];
};
