import { createContext, useContext } from 'react';

export interface ThreadTraceRowContextValue {
  traceId: string;
  /** Position of the turn in the thread, starting at 1. */
  turn: number;
  /** This turn's trace is open in the trace column. */
  isActive: boolean;
  /** The first row in view. */
  isCurrent: boolean;
  isAnchor: boolean;
  /** Highlight spans of this turn; opens its trace. */
  highlightSpans: (spanIds: string[]) => void;
  /** Open or close this turn's trace. */
  toggleTrace: () => void;
}

export const ThreadTraceRowContext = createContext<ThreadTraceRowContextValue | null>(null);

export function useThreadTraceRow(): ThreadTraceRowContextValue {
  const context = useContext(ThreadTraceRowContext);
  if (!context) {
    throw new Error('ThreadTrace row parts must be rendered inside <ThreadTrace.Row>.');
  }
  return context;
}
