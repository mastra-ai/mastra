import type {
  NotificationDeliveryAction,
  NotificationDeliveryDecision,
  NotificationDeliveryThreadState,
  NotificationPriority,
  NotificationRecord,
  NotificationStatus,
} from './types';

/**
 * Delivery attempts allowed before a notification is marked `failed`. A failed
 * record is no longer due, so a deterministic delivery error (a missing model,
 * a rejected request context) stops being retried on every dispatch tick.
 */
export const MAX_NOTIFICATION_DELIVERY_ATTEMPTS = 5;

/**
 * Attempt bookkeeping applied when a delivery attempt throws, spread into the
 * `updateNotification` call at each failure site.
 */
export function resolveDeliveryFailureUpdate(record: NotificationRecord): {
  deliveryAttempts: number;
  status?: NotificationStatus;
} {
  const attempts = record.deliveryAttempts ?? 0;
  // Records written before the cap existed can already be past it. Terminalize
  // them at their recorded count instead of inflating it further.
  if (attempts >= MAX_NOTIFICATION_DELIVERY_ATTEMPTS) return { deliveryAttempts: attempts, status: 'failed' };
  const deliveryAttempts = attempts + 1;
  if (deliveryAttempts < MAX_NOTIFICATION_DELIVERY_ATTEMPTS) return { deliveryAttempts };
  return { deliveryAttempts, status: 'failed' };
}

export type NotificationDeliveryPolicyDecision = NotificationDeliveryAction | NotificationDeliveryDecision;

export type NotificationDeliveryPolicyInput = {
  record: NotificationRecord;
  threadState: NotificationDeliveryThreadState;
  now: Date;
};

/**
 * Custom delivery decision logic. Runs at receipt time (when the notification
 * is sent) and, for records the receipt-time decision deferred or scheduled
 * for summary, AGAIN at delivery time when the dispatch workflow picks them
 * up. At delivery time only the decision's `streamOptions` is honored — the
 * record's persisted schedule already fixed when and how it delivers — so
 * deciders should be side-effect free.
 */
export type NotificationDeliveryPolicyDecider = (
  input: NotificationDeliveryPolicyInput,
) => NotificationDeliveryPolicyDecision | undefined | Promise<NotificationDeliveryPolicyDecision | undefined>;

export type NotificationDeliveryPolicyConfig = {
  default?: NotificationDeliveryPolicyDecision;
  priorities?: Partial<Record<NotificationPriority, NotificationDeliveryPolicyDecision>>;
  sources?: Record<string, NotificationDeliveryPolicyDecision>;
  decide?: NotificationDeliveryPolicyDecider;
};

const normalizeDecision = (decision: NotificationDeliveryPolicyDecision): NotificationDeliveryDecision => {
  if (typeof decision === 'string') return { action: decision };
  return decision;
};

export function defaultNotificationDeliveryDecision(
  input: NotificationDeliveryPolicyInput,
): NotificationDeliveryDecision {
  if (input.record.priority === 'urgent') {
    return { action: 'deliver', reason: 'urgent' };
  }

  if (input.record.priority === 'high') {
    return input.threadState === 'active'
      ? { action: 'summarize', summaryAt: input.now, deliverAt: input.now, reason: 'active-high-summary-then-full' }
      : { action: 'deliver', reason: 'idle-high' };
  }

  if (input.record.priority === 'medium') {
    return input.threadState === 'active'
      ? { action: 'summarize', summaryAt: input.now, reason: 'active-batch-summary' }
      : { action: 'deliver', reason: 'idle-medium' };
  }

  return {
    action: 'summarize',
    summaryAt: input.now,
    reason: input.threadState === 'active' ? 'active-batch-summary' : 'idle-low-summary',
  };
}

export async function resolveNotificationDeliveryDecision({
  config,
  ...input
}: NotificationDeliveryPolicyInput & {
  config?: NotificationDeliveryPolicyConfig;
}): Promise<NotificationDeliveryDecision> {
  const custom = await config?.decide?.(input);
  if (custom) return normalizeDecision(custom);

  const sourceDecision = config?.sources?.[input.record.source];
  if (sourceDecision) return normalizeDecision(sourceDecision);

  const priorityDecision = config?.priorities?.[input.record.priority];
  if (priorityDecision) return normalizeDecision(priorityDecision);

  if (config?.default) return normalizeDecision(config.default);

  return defaultNotificationDeliveryDecision(input);
}
