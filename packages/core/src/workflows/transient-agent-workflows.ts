import type { ShouldPersistSnapshotFn } from './types';

// Only framework-created preparation/processor workflows belong here. User workflows,
// including workflows supplied as processors, retain cross-process cancellation.
const transientAgentWorkflows = new WeakSet<object>();
const neverPersist: ShouldPersistSnapshotFn = () => false;

export function markTransientAgentWorkflow<T extends object>(workflow: T): T {
  transientAgentWorkflows.add(workflow);
  return workflow;
}

export function getTransientAgentWorkflowPolicy(workflow: object): ShouldPersistSnapshotFn | undefined {
  return transientAgentWorkflows.has(workflow) ? neverPersist : undefined;
}
