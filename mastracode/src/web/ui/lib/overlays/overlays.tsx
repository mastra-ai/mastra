import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Cross-cutting open/close state for the app's named overlays. Overlay
 * visibility is platform-level UI plumbing (not chat/workspace domain state),
 * so it lives here in `lib` and is consumed via `useOverlays()` instead of
 * being prop-drilled through the layout tree.
 */

export type OverlayName = 'sidebar' | 'palette' | 'settings' | 'shortcuts' | 'projects';

export interface OverlaysApi {
  isOpen: (name: OverlayName) => boolean;
  open: (name: OverlayName) => void;
  close: (name: OverlayName) => void;
  toggle: (name: OverlayName) => void;
  closeAll: () => void;
}

const CLOSED: Record<OverlayName, boolean> = {
  sidebar: false,
  palette: false,
  settings: false,
  shortcuts: false,
  projects: false,
};

const OverlaysContext = createContext<OverlaysApi | null>(null);

export function OverlaysProvider({ children }: { children: ReactNode }) {
  const [openState, setOpenState] = useState<Record<OverlayName, boolean>>(CLOSED);

  const isOpen = useCallback((name: OverlayName) => openState[name], [openState]);
  const open = useCallback((name: OverlayName) => setOpenState(state => ({ ...state, [name]: true })), []);
  const close = useCallback((name: OverlayName) => setOpenState(state => ({ ...state, [name]: false })), []);
  const toggle = useCallback((name: OverlayName) => setOpenState(state => ({ ...state, [name]: !state[name] })), []);
  const closeAll = useCallback(() => setOpenState(CLOSED), []);

  const value = useMemo<OverlaysApi>(
    () => ({ isOpen, open, close, toggle, closeAll }),
    [isOpen, open, close, toggle, closeAll],
  );

  return <OverlaysContext.Provider value={value}>{children}</OverlaysContext.Provider>;
}

export function useOverlays(): OverlaysApi {
  const ctx = useContext(OverlaysContext);
  if (!ctx) throw new Error('useOverlays must be used within an OverlaysProvider');
  return ctx;
}
