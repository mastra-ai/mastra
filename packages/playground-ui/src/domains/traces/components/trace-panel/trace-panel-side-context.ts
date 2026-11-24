import { createContext, useContext } from 'react';

export interface TracePanelSideContextValue {
  /** The side column is 500px wide or less: its controls collapse to icons. */
  compact: boolean;
}

export const TracePanelSideContext = createContext<TracePanelSideContextValue>({ compact: false });

/** The side column's width, for actions that collapse with it; not compact outside a `TracePanel.Side`. */
export function useTracePanelSide(): TracePanelSideContextValue {
  return useContext(TracePanelSideContext);
}
