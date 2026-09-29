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

/** Which columns are open: the conversation alone, plus a turn's trace, plus one of its spans. */
export type ThreadTraceLayout = 'conversation' | 'trace' | 'span';

export interface ThreadTraceContextValue {
  traceIds: string[];
  /** The row the reader came from (e.g. "Open full thread"); its trace opens and it scrolls into view on mount. */
  anchorTraceId: string | null;
  /** The turn whose trace is shown in the trace column. */
  openTraceId: string | null;
  /** Show a turn's trace in the trace column, or pass `null` to close it (and the span column). */
  openTrace: (traceId: string | null) => void;
  /** Opens the turn's trace, or closes it when it is already the open one. */
  toggleTrace: (traceId: string) => void;
  selected: ThreadTraceSelectedSpan | null;
  /** Select a span (opens the span column) or pass `undefined` to close it. */
  selectSpan: (traceId: string, spanId: string | undefined) => void;
  /** Spans behind the message the user asked to highlight; opens that turn's trace. */
  highlight: ThreadTraceHighlight | null;
  highlightSpans: (traceId: string, spanIds: string[]) => void;
  layout: ThreadTraceLayout;
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
