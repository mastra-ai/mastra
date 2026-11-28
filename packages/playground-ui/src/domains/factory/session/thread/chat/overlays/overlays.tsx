import { useState } from 'react';
import type { ReactNode } from 'react';

import { OverlaysContext } from './OverlaysContext';
import type { OverlayName, OverlaysApi } from './OverlaysContext';

const CLOSED: Record<OverlayName, boolean> = {
  search: false,
  sidebar: false,
  shortcuts: false,
};

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
