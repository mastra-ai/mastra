import type {
  NotificationDeliveryAction,
  NotificationDeliveryDecision,
  NotificationDeliveryThreadState,
  NotificationPriority,
  NotificationRecord,
} from './types';

export type NotificationDeliveryPolicyDecision = NotificationDeliveryAction | NotificationDeliveryDecision;

export type NotificationDeliveryPolicyInput = {
  record: NotificationRecord;
  threadState: NotificationDeliveryThreadState;
  now: Date;
};

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
