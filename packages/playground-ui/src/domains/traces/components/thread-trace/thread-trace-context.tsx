import { createContext, useContext } from 'react';
import type { RefObject } from 'react';

export interface ThreadTraceSelectedSpan {
  traceId: string;
  spanId: string;
}

export interface ThreadTraceHighlight {
  traceId: string;
  spanIds: string[];
}

export interface ThreadTraceContextValue {
  traceIds: string[];
  /** The row the reader came from (e.g. "View full thread"); starts expanded and scrolls into view on mount. */
  anchorTraceId: string | null;
  selected: ThreadTraceSelectedSpan | null;
  /** Select a span (opens the side panel) or pass `undefined` to close it. */
  selectSpan: (traceId: string, spanId: string | undefined) => void;
  /** Spans behind the message the user asked to highlight; scoped to one trace since each row has its own tree. */
  highlight: ThreadTraceHighlight | null;
  highlightSpans: (traceId: string, spanIds: string[]) => void;
  /** Rows whose timeline is shown in full rather than clamped to the messages column. */
  expandedTraceIds: ReadonlySet<string>;
  setTraceExpanded: (traceId: string, expanded: boolean) => void;
  /** Rows currently on screen inside the list, oldest first. */
  visibleTraceIds: string[];
  /** The topmost visible row. */
  currentTraceId: string | undefined;
  scrollToTrace: (traceId: string) => void;
  listRef: RefObject<HTMLDivElement | null>;
}

export const ThreadTraceContext = createContext<ThreadTraceContextValue | null>(null);

export function useThreadTrace(): ThreadTraceContextValue {
  const context = useContext(ThreadTraceContext);
  if (!context) {
    throw new Error('ThreadTrace compound components must be rendered inside <ThreadTrace>.');
  }
  return context;
}
