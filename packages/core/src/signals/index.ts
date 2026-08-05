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

// Task signal payload types. These describe the task list that `TaskSignalProvider`
// projects onto the state-signal lane, so this is their canonical home.
export type {
  TaskItem,
  TaskItemInput,
  TaskItemSnapshot,
  TaskCheckResult,
  TaskCheckSummary,
} from '../tools/builtin/task-tools';

// `assignTaskIds` derives stable task IDs for the task list projected by
// `TaskSignalProvider`, so it belongs with the task signal payload types.
export { assignTaskIds } from '../tools/builtin/task-tools';

// `GoalSignalProvider` projects the agent's current objective onto the
// state-signal lane. Auto-registered when an agent is configured with `goal`.
// The implementation lives with the goal built-in under `agent/goal`.
export { GoalSignalProvider } from '../agent/goal';

// Signal factories and the canonical DB-message <-> signal reconstruction helpers.
// Consumers that read persisted `role: 'signal'` `MastraDBMessage` rows use
// `mastraDBMessageToSignal` to recover the original signal (type, tagName, contents,
// attributes, metadata) instead of parsing `content.metadata.signal` by hand.
export { createSignal, mastraDBMessageToSignal, isCreatedAgentSignal, type CreatedAgentSignal } from '../agent/signals';
