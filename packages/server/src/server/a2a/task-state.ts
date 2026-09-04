import type { TaskState } from '@mastra/core/a2a';

export function isTerminalTaskState(state: TaskState | undefined): boolean {
  return state === 'completed' || state === 'failed' || state === 'canceled' || state === 'rejected';
}

export function isInterruptedTaskState(state: TaskState | undefined): boolean {
  return state === 'input-required' || state === 'auth-required';
}
