export interface BackgroundCompletionEvent {
  id: string;
  taskId: string;
  originRunId: string;
  originToolCallId: string;
  resourceId: string;
  threadId: string;
  toolName: string;
  status: 'completed' | 'failed' | 'cancelled';
  argsSummary?: string;
  errorSummary?: string;
}

export interface BackgroundCompletionEvents {
  publish(event: BackgroundCompletionEvent): void;
  subscribe(listener: (event: BackgroundCompletionEvent) => void): () => void;
}

export function createBackgroundCompletionEvents(): BackgroundCompletionEvents {
  const listeners = new Set<(event: BackgroundCompletionEvent) => void>();

  return {
    publish(event) {
      for (const listener of listeners) listener(event);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
