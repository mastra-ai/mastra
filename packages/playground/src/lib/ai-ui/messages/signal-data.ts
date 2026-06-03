export type SignalData = {
  id?: string;
  type?: string;
  tagName?: string;
  contents?: unknown;
  attributes?: Record<string, string | number | boolean | null | undefined>;
  metadata?: Record<string, unknown>;
};

export type NotificationSignalMetadata = {
  signal?: 'notification' | 'summary';
  recordId?: string;
  source?: string;
  kind?: string;
  priority?: string;
  status?: string;
  pending?: number;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isSignalData = (value: unknown): value is SignalData => {
  if (!isRecord(value)) return false;
  return value.type === 'notification' || value.type === 'state' || value.type === 'reactive';
};

export const getNotificationMetadata = (signal: SignalData): NotificationSignalMetadata | undefined => {
  const notification = isRecord(signal.metadata?.notification) ? signal.metadata.notification : undefined;
  if (!notification) return undefined;

  return {
    signal:
      notification.signal === 'notification' || notification.signal === 'summary' ? notification.signal : undefined,
    recordId: typeof notification.recordId === 'string' ? notification.recordId : undefined,
    source: typeof notification.source === 'string' ? notification.source : undefined,
    kind: typeof notification.kind === 'string' ? notification.kind : undefined,
    priority: typeof notification.priority === 'string' ? notification.priority : undefined,
    status: typeof notification.status === 'string' ? notification.status : undefined,
    pending: typeof notification.pending === 'number' ? notification.pending : undefined,
  };
};
