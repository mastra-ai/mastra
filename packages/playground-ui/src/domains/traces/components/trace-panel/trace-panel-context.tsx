import { createContext, useContext } from 'react';

import type { LightSpanRecord } from '../../types';

/** A span of the panel: the light record, plus the signal that started it when one did. */
export type TracePanelSpan = LightSpanRecord & { signalLabel?: string };

/** Which of the two span layouts the main column shows. */
export type TraceSpanView = 'tree' | 'timeline';

/** The standard views of the side column; a host may add its own under any other value. */
export type TraceSideView = 'messages' | 'feedback' | 'scores';

export interface TracePanelContextValue {
  traceId: string;
  /** The spans the root was given, in whatever order the host loaded them. */
  spans: TracePanelSpan[] | undefined;
  isLoading: boolean;
  /** Span treated as the displayed root (a branch anchor), when the host gave one. */
  anchorSpanId?: string;
  /** The displayed root: the anchor, else the span without a parent. */
  rootSpan?: TracePanelSpan;
  /** Root entity type; the resizable columns remember their widths per value. */
  layoutKey?: string;
  /** The span whose detail is open. */
  selectedSpanId?: string;
  /** Opens a span (or closes it with `undefined`) and tells the host. */
  selectSpan: (spanId: string | undefined) => void;
  /** The span search query; it also highlights matches across the columns. */
  query: string;
  setQuery: (query: string) => void;
  spanView: TraceSpanView;
  setSpanView: (view: TraceSpanView) => void;
  /** The side column view picked by the reader or the host (e.g. Scores once a scorer started). */
  sideView?: string;
  setSideView: (view: string) => void;
  /** The scoring dialog is open (`TracePanel.ScoreButton` opens it, `TracePanel.ScoreDialog` shows it). */
  isScoring: boolean;
  setScoring: (open: boolean) => void;
  onClose: () => void;
}

export const TracePanelContext = createContext<TracePanelContextValue | null>(null);

export function useTracePanel(): TracePanelContextValue {
  const context = useContext(TracePanelContext);
  if (!context) throw new Error('TracePanel parts must be rendered inside <TracePanel>.');
  return context;
}
