import type { CreatedAgentSignal } from './signals';
import type {
  AgentDeliveryPolicyConfig,
  AgentDeliveryPolicyInput,
  AgentDeliveryPolicyOutcome,
  AgentDeliveryPriority,
  AgentDeliveryThreadState,
} from './types';

export function getSignalDeliveryPriority(signal: CreatedAgentSignal): AgentDeliveryPriority {
  const priority =
    signal.attributes?.priority ?? (signal.metadata?.notification as { priority?: unknown } | undefined)?.priority;
  return priority === 'low' || priority === 'medium' || priority === 'high' || priority === 'urgent'
    ? priority
    : 'medium';
}

export function getSignalDeliverySource(signal: CreatedAgentSignal): string | undefined {
  const notification = signal.metadata?.notification as { source?: unknown } | undefined;
  return typeof signal.attributes?.source === 'string'
    ? signal.attributes.source
    : typeof notification?.source === 'string'
      ? notification.source
      : undefined;
}

export function defaultDeliveryPolicy(input: AgentDeliveryPolicyInput): AgentDeliveryPolicyOutcome {
  if (input.explicitApi === 'queueMessage') return 'queue';
  if (input.category === 'notification') {
    if (input.priority === 'urgent') return 'deliver';
    if (input.threadState === 'idle' && input.priority === 'high') return 'wake';
    return 'summarize';
  }
  if (input.category === 'state') return 'persist';
  if (input.threadState === 'idle') return 'wake';
  return 'deliver';
}

export function resolveDeliveryPolicy(input: AgentDeliveryPolicyInput): AgentDeliveryPolicyOutcome {
  const sourceOverride = input.source ? input.config?.sources?.[input.source] : undefined;
  const configured = sourceOverride?.[input.category] ?? input.config?.categories?.[input.category];
  if (configured) return configured;
  return input.config?.decide?.(input) ?? defaultDeliveryPolicy(input);
}

export function shouldApplyDeliveryPolicy(
  config: AgentDeliveryPolicyConfig | undefined,
): config is AgentDeliveryPolicyConfig {
  return Boolean(config);
}

export function createDeliveryPolicyInput({
  signal,
  threadState,
  explicitApi,
  config,
}: {
  signal: CreatedAgentSignal;
  threadState: AgentDeliveryThreadState;
  explicitApi: AgentDeliveryPolicyInput['explicitApi'];
  config?: AgentDeliveryPolicyConfig;
}): AgentDeliveryPolicyInput {
  return {
    signal,
    category: signal.type,
    tagName: signal.tagName,
    priority: getSignalDeliveryPriority(signal),
    source: getSignalDeliverySource(signal),
    threadState,
    explicitApi,
    config,
  };
}
