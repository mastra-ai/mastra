import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type OverlayName = 'search' | 'sidebar' | 'shortcuts';

export interface OverlaysApi {
  isOpen: (name: OverlayName) => boolean;
  open: (name: OverlayName) => void;
  close: (name: OverlayName) => void;
  toggle: (name: OverlayName) => void;
}

const CLOSED: Record<OverlayName, boolean> = {
  search: false,
  sidebar: false,
  shortcuts: false,
};

const OverlaysContext = createContext<OverlaysApi | null>(null);

// Consumers sit in unrelated branches of the layout tree — context, not props
export function OverlaysProvider({ children }: { children: ReactNode }) {
  const [openState, setOpenState] = useState<Record<OverlayName, boolean>>(CLOSED);

  const isOpen = (name: OverlayName) => openState[name];
  const open = (name: OverlayName) => setOpenState(state => ({ ...state, [name]: true }));
  const close = (name: OverlayName) => setOpenState(state => ({ ...state, [name]: false }));
  const toggle = (name: OverlayName) => setOpenState(state => ({ ...state, [name]: !state[name] }));

  const value: OverlaysApi = { isOpen, open, close, toggle };

  return <OverlaysContext.Provider value={value}>{children}</OverlaysContext.Provider>;
}

export function useOverlays(): OverlaysApi {
  const ctx = useContext(OverlaysContext);
  if (!ctx) throw new Error('useOverlays must be used within an OverlaysProvider');
  return ctx;
}
