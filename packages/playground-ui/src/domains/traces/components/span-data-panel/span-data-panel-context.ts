import { createContext, useContext } from 'react';

import type { SpanRecord } from '../../types';

/** How payloads read: previewed (`rich`) or as JSON (`raw`). */
export type PayloadView = 'rich' | 'raw';

export interface SpanDataPanelContextValue {
  traceId: string;
  spanId: string;
  /** The span record, once the host has it. */
  span?: SpanRecord;
  /** Shared by the Input and Output tabs, and kept when another span opens, so spans compare like for like. */
  view: PayloadView;
  setView: (view: PayloadView) => void;
}

export const SpanDataPanelContext = createContext<SpanDataPanelContextValue | null>(null);

export function useSpanDataPanel(): SpanDataPanelContextValue {
  const context = useContext(SpanDataPanelContext);
  if (!context) throw new Error('SpanDataPanel parts must be rendered inside <SpanDataPanel>.');
  return context;
}
