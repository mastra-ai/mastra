import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Cross-cutting open/close state for the app's named overlays. Overlay
 * visibility is platform-level UI plumbing (not chat/workspace domain state),
 * so it lives here in `lib` and is consumed via `useOverlays()` instead of
 * being prop-drilled through the layout tree.
 */

export type OverlayName = 'sidebar' | 'shortcuts';

export interface OverlaysApi {
  isOpen: (name: OverlayName) => boolean;
  open: (name: OverlayName) => void;
  close: (name: OverlayName) => void;
  toggle: (name: OverlayName) => void;
  closeAll: () => void;
}

const CLOSED: Record<OverlayName, boolean> = {
  sidebar: false,
  shortcuts: false,
};

const OverlaysContext = createContext<OverlaysApi | null>(null);

export function OverlaysProvider({ children }: { children: ReactNode }) {
  const [openState, setOpenState] = useState<Record<OverlayName, boolean>>(CLOSED);

  const isOpen = (name: OverlayName) => openState[name];
  const open = (name: OverlayName) => setOpenState(state => ({ ...state, [name]: true }));
  const close = (name: OverlayName) => setOpenState(state => ({ ...state, [name]: false }));
  const toggle = (name: OverlayName) => setOpenState(state => ({ ...state, [name]: !state[name] }));
  const closeAll = () => setOpenState(CLOSED);

  const value: OverlaysApi = { isOpen, open, close, toggle, closeAll };

  return <OverlaysContext.Provider value={value}>{children}</OverlaysContext.Provider>;
}

export function useOverlays(): OverlaysApi {
  const ctx = useContext(OverlaysContext);
  if (!ctx) throw new Error('useOverlays must be used within an OverlaysProvider');
  return ctx;
}
