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
  isAnchor: boolean;
  selectedSpanId: string | undefined;
  featuredSpanIds: string[] | undefined;
  revealSpanId: string | undefined;
  /** Highlight spans of this row in its span tree. */
  highlightSpans: (spanIds: string[]) => void;
  setExpanded: (expanded: boolean) => void;
  /** The view shown by the messages column (Messages / Feedback / Scores). */
  tab: string;
  setTab: (tab: string) => void;
  /** Measured heights; the timeline is clamped to the messages column minus the details header. */
  messagesRef: RefCallback<HTMLDivElement>;
  timelineRef: RefCallback<HTMLDivElement>;
  detailsHeaderRef: RefCallback<HTMLDivElement>;
  messagesHeight: number | null;
  timelineHeight: number | null;
  detailsHeaderHeight: number | null;
}

export const ThreadTraceRowContext = createContext<ThreadTraceRowContextValue | null>(null);

export function useThreadTraceRow(): ThreadTraceRowContextValue {
  const context = useContext(ThreadTraceRowContext);
  if (!context) {
    throw new Error('ThreadTrace row parts must be rendered inside <ThreadTrace.Row>.');
  }
  return context;
}
