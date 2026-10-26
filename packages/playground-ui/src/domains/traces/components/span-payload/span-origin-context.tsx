import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

interface TraceSpanRef {
  spanId: string;
  name: string;
}

interface SpanOriginContextValue {
  spans: ReadonlyArray<TraceSpanRef>;
  onSpanSelect: (spanId: string) => void;
}

const SpanOriginContext = createContext<SpanOriginContextValue | undefined>(undefined);

export interface SpanOriginProviderProps {
  /** Spans of the current trace; an origin outside this list renders no link. */
  spans: ReadonlyArray<TraceSpanRef> | undefined;
  onSpanSelect: ((spanId: string) => void) | undefined;
  children: ReactNode;
}

/** Lets payload renderers link a value back to the span of the trace that produced it. */
export function SpanOriginProvider({ spans, onSpanSelect, children }: SpanOriginProviderProps) {
  if (!spans || !onSpanSelect) return children;
  return <SpanOriginContext.Provider value={{ spans, onSpanSelect }}>{children}</SpanOriginContext.Provider>;
}

/** The trace span with this id and a way to select it, or `undefined` when it cannot be linked. */
// eslint-disable-next-line react-refresh/only-export-components -- the hook reads this module's private context
export function useOriginSpan(spanId: string | undefined) {
  const context = useContext(SpanOriginContext);
  if (!spanId || !context) return undefined;
  const span = context.spans.find(candidate => candidate.spanId === spanId);
  if (!span) return undefined;
  return { name: span.name, select: () => context.onSpanSelect(span.spanId) };
}
