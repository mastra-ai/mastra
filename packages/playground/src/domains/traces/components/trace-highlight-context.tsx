import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

export interface TraceHighlightContextValue {
  /** Called when a tool collapsible is opened, so the trace view can feature the spans behind it. */
  onToolOpen?: (toolCallId: string) => void;
}

const TraceHighlightContext = createContext<TraceHighlightContextValue>({});

export const TraceHighlightProvider = ({
  onToolOpen,
  children,
}: TraceHighlightContextValue & { children: ReactNode }) => {
  const value = useMemo(() => ({ onToolOpen }), [onToolOpen]);
  return <TraceHighlightContext.Provider value={value}>{children}</TraceHighlightContext.Provider>;
};

/** Returns an empty object outside a provider so tool badges keep working in the regular chat. */
// eslint-disable-next-line react-refresh/only-export-components
export const useTraceHighlight = () => useContext(TraceHighlightContext);
