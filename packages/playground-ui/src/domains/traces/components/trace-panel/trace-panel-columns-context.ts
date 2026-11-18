import { createContext, useContext } from 'react';

export interface TracePanelColumnsContextValue {
  /** Starting widths of the side and span columns, in pixels. */
  sideWidth: () => number;
  spanWidth: () => number;
}

export const TracePanelColumnsContext = createContext<TracePanelColumnsContextValue | null>(null);

export function useTracePanelColumns(): TracePanelColumnsContextValue {
  const context = useContext(TracePanelColumnsContext);
  if (!context) throw new Error('TracePanel columns must be rendered inside <TracePanel.Body>.');
  return context;
}
