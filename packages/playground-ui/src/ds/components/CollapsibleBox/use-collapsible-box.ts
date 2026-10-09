import { useState } from 'react';

export const DEFAULT_COLLAPSED_HEIGHT = 220;

export interface CollapsibleBoxState {
  collapsedHeight: number;
  isExpanded: boolean;
  /** Whether the rendered content overflows the collapsed height (measured, not estimated). */
  isClipped: boolean;
  setClipped: (clipped: boolean) => void;
  setExpanded: (expanded: boolean) => void;
  toggleExpanded: () => void;
}

/** State for a `CollapsibleBox`. Keep it next to your own expand control, which can live anywhere. */
export function useCollapsibleBox({
  collapsedHeight = DEFAULT_COLLAPSED_HEIGHT,
}: { collapsedHeight?: number } = {}): CollapsibleBoxState {
  const [isExpanded, setExpanded] = useState(false);
  const [isClipped, setClipped] = useState(false);

  return {
    collapsedHeight,
    isExpanded,
    isClipped,
    setClipped,
    setExpanded,
    toggleExpanded: () => setExpanded(current => !current),
  };
}
