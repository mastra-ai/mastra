import { createContext, useContext } from 'react';

export interface TracePanelSideContextValue {
  /** The view the side column shows. */
  view?: string;
  setView: (view: string) => void;
  /** The column is 500px wide or less: tab labels collapse to icons. */
  compact: boolean;
}

export const TracePanelSideContext = createContext<TracePanelSideContextValue | null>(null);

/** The side column's view and width, for custom tabs, contents and actions. */
export function useTracePanelSide(): TracePanelSideContextValue {
  const context = useContext(TracePanelSideContext);
  if (!context) throw new Error('TracePanel side parts must be rendered inside <TracePanel.Side>.');
  return context;
}
