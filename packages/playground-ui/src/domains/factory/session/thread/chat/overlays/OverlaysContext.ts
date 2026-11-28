import { createContext, useContext } from 'react';

export type OverlayName = 'search' | 'sidebar' | 'shortcuts';

export interface OverlaysApi {
  isOpen: (name: OverlayName) => boolean;
  open: (name: OverlayName) => void;
  close: (name: OverlayName) => void;
  toggle: (name: OverlayName) => void;
}

export const OverlaysContext = createContext<OverlaysApi | null>(null);

export function useOverlays(): OverlaysApi {
  const ctx = useContext(OverlaysContext);
  if (!ctx) throw new Error('useOverlays must be used within an OverlaysProvider');
  return ctx;
}
