export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type NotificationStatus = 'pending' | 'delivered' | 'seen' | 'dismissed' | 'archived' | 'discarded';

export type NotificationSignalAttributes = Record<string, string | number | boolean | null | undefined>;

export type NotificationSignalMetadata = {
  signal: 'notification';
  recordId: string;
  source: string;
  kind: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  coalescedCount?: number;
  deliveredAt?: string;
  seenAt?: string;
};

export type NotificationSummarySignalMetadata = {
  signal: 'summary';
  pending: number;
  groups: Array<{ source: string; count: number }>;
  byPriority: Partial<Record<NotificationPriority, number>>;
  notificationIds: string[];
  priority?: NotificationPriority;
};

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
  attributes?: NotificationSignalAttributes;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
  seenAt?: Date;
  dismissedAt?: Date;
  archivedAt?: Date;
  discardedAt?: Date;
  deliverAt?: Date;
  summaryAt?: Date;
  deliveryReason?: string;
  deliveryAttempts?: number;
  lastDeliveryAttemptAt?: Date;
  lastDeliveryError?: string;
  deliveredSignalId?: string;
  summarySignalId?: string;
  metadata?: Record<string, unknown>;
};

export type SendNotificationSignalInput = {
  source: string;
  kind: string;
  summary: string;
  priority?: NotificationPriority;
  payload?: unknown;
  sourceId?: string;
  dedupeKey?: string;
  coalesceKey?: string;
  attributes?: NotificationSignalAttributes;
  metadata?: Record<string, unknown>;
};

export type CreateNotificationInput = SendNotificationSignalInput & {
  id?: string;
  threadId: string;
  resourceId?: string;
  agentId?: string;
  deliverAt?: Date;
  summaryAt?: Date;
  deliveryReason?: string;
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

export type ListDueNotificationsInput = {
  now: Date;
  limit?: number;
  agentId?: string;
  resourceId?: string;
};

export type UpdateNotificationInput = {
  id: string;
  threadId: string;
  status?: NotificationStatus;
  summary?: string;
  payload?: unknown;
  attributes?: NotificationSignalAttributes;
  metadata?: Record<string, unknown>;
  deliverAt?: Date | null;
  summaryAt?: Date | null;
  deliveryReason?: string;
  deliveryAttempts?: number;
  lastDeliveryAttemptAt?: Date;
  lastDeliveryError?: string;
  deliveredSignalId?: string;
  summarySignalId?: string;
};

export type NotificationSummary = {
  threadId: string;
  resourceId?: string;
  agentId?: string;
  pending: number;
  bySource: Record<string, number>;
  byPriority: Partial<Record<NotificationPriority, number>>;
  notificationIds: string[];
};

export type NotificationDeliveryThreadState = 'active' | 'idle';

export type NotificationDeliveryAction = 'deliver' | 'queue' | 'defer' | 'summarize' | 'persist' | 'discard';

export type NotificationDeliveryDecision = {
  action: NotificationDeliveryAction;
  deliverAt?: Date;
  summaryAt?: Date;
  reason?: string;
};
