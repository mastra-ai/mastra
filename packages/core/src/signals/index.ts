export {
  SignalProvider,
  isSignalProvider,
  type SignalProviderTarget,
  type SignalSubscription,
  type SignalProviderWebhookRequest,
} from './signal-provider';

export { WebhookSignalProvider, type WebhookSignalProviderOptions } from './webhook-signal-provider';

// `TaskSignalProvider` is a SignalProvider that bundles the built-in task tools
// and the TaskStateProcessor so they are registered together on an agent.
export { TaskSignalProvider } from './task-signal-provider';

// `GoalSignalProvider` projects the agent's current objective onto the
// state-signal lane. Auto-registered when an agent is configured with `goal`.
export { GoalSignalProvider } from './goal-signal-provider';
