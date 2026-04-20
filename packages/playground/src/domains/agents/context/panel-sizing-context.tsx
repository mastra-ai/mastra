/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useMemo } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { usePanelRef } from 'react-resizable-panels';

export const RIGHT_PANEL_MAX_PERCENT = 50;

export interface PanelSizingContextValue {
  rightPanelRef: RefObject<PanelImperativeHandle | null>;
  adjustSizeForSecondCard: () => void;
}

export const PanelSizingContext = createContext<PanelSizingContextValue | null>(null);

export function PanelSizingProvider({ children }: { children: ReactNode }) {
  const rightPanelRef = usePanelRef();

  const adjustSizeForSecondCard = useCallback(() => {
    const panel = rightPanelRef.current;
    if (!panel) return;

    const { asPercentage } = panel.getSize();
    const halfOfMax = RIGHT_PANEL_MAX_PERCENT / 2;
    const next = asPercentage <= halfOfMax ? asPercentage * 2 : RIGHT_PANEL_MAX_PERCENT;

    panel.resize(`${next}%`);
  }, [rightPanelRef]);

  const value = useMemo(() => ({ rightPanelRef, adjustSizeForSecondCard }), [rightPanelRef, adjustSizeForSecondCard]);

  return <PanelSizingContext.Provider value={value}>{children}</PanelSizingContext.Provider>;
}
