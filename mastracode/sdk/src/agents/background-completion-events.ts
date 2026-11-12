export interface BackgroundTaskCompletionEvent {
  kind?: 'task';
  id: string;
  taskId: string;
  originRunId: string;
  originToolCallId: string;
  resourceId: string;
  threadId: string;
  toolName: string;
  status: 'completed' | 'failed' | 'cancelled';
}

/** A background `execute_command` process exited. */
export interface BackgroundProcessExitEvent {
  kind: 'process';
  id: string;
  pid: string;
  command?: string;
  exitCode: number;
  /** True when the process was killed (by the agent, the user, an abort or shutdown) rather than exiting on its own. */
  killed: boolean;
  toolCallId?: string;
  resourceId?: string;
  threadId?: string;
}

export type BackgroundCompletionEvent = BackgroundTaskCompletionEvent | BackgroundProcessExitEvent;

export interface BackgroundCompletionEvents {
  publish(event: BackgroundCompletionEvent): void;
  subscribe(listener: (event: BackgroundCompletionEvent) => void): () => void;
}

export function createBackgroundCompletionEvents(): BackgroundCompletionEvents {
  const listeners = new Set<(event: BackgroundCompletionEvent) => void>();

  return {
    publish(event) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // A listener must not prevent other subscribers from receiving the completion.
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
