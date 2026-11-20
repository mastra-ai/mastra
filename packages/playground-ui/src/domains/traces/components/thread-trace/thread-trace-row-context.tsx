import { createContext, useContext } from 'react';
import type { RefCallback } from 'react';

export interface ThreadTraceRowContextValue {
  traceId: string;
  /** A span of this row is open in the side panel. */
  isActive: boolean;
  /** The first row in view. */
  isCurrent: boolean;
  /** The timeline is shown in full rather than clamped to the messages column. */
  isExpanded: boolean;
  selectedSpanId: string | undefined;
  featuredSpanIds: string[] | undefined;
  revealSpanId: string | undefined;
  /** Highlight spans of this row in its span tree. */
  highlightSpans: (spanIds: string[]) => void;
  setExpanded: (expanded: boolean) => void;
  /** Measured heights; the timeline is clamped to the messages column minus the details header. */
  timelineRef: RefCallback<HTMLDivElement>;
  messagesHeight: number | null;
  timelineHeight: number | null;
  detailsHeaderHeight: number | null;
}

export const ThreadTraceRowContext = createContext<ThreadTraceRowContextValue | null>(null);

export function useThreadTraceRow(): ThreadTraceRowContextValue {
  const context = useContext(ThreadTraceRowContext);
  if (!context) {
    throw new Error('ThreadTrace turn parts must be rendered inside a <ThreadTrace.Row> slot.');
  }
  return context;
}
