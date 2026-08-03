import React from 'react';
import type { LinkComponent } from '@/ds/types/link-component';

export type SidebarState = 'default' | 'collapsed';

type MainSidebarContextValue = {
  state: SidebarState;
  desktopState: SidebarState;
  width: number;
  minWidth: number;
  maxWidth: number;
  collapseBelow: number;
  collapsedWidth: number;
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
  setWidth: (width: number) => void;
  collapse: () => void;
  expand: () => void;
  commit: () => void;
  setGestureActive: (active: boolean) => void;
  LinkComponent?: LinkComponent;
};

// Split: drawer open-state lives in its own context so navigation rows
// do not re-render when the mobile drawer toggles.
export type MobileDrawerContextValue = {
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
};

export type MainSidebarStateContextValue = Omit<MainSidebarContextValue, 'openMobile' | 'setOpenMobile'>;

export const MainSidebarContext = React.createContext<MainSidebarStateContextValue | null>(null);
export const MobileDrawerContext = React.createContext<MobileDrawerContextValue | null>(null);

/** Reads sidebar state and actions without subscribing to mobile drawer state. */
export function useMaybeSidebarState(): MainSidebarStateContextValue | null {
  return React.useContext(MainSidebarContext);
}

export function useMainSidebar(): MainSidebarContextValue {
  const ctx = React.useContext(MainSidebarContext);
  const drawer = React.useContext(MobileDrawerContext);
  if (!ctx || !drawer) {
    throw new Error('useMainSidebar must be used within a MainSidebarProvider.');
  }
  return { ...ctx, ...drawer };
}

export function useMaybeSidebar(): MainSidebarContextValue | null {
  const ctx = React.useContext(MainSidebarContext);
  const drawer = React.useContext(MobileDrawerContext);
  if (!ctx || !drawer) return null;
  return { ...ctx, ...drawer };
}

/** Reads only mobile drawer state. Cheap — no re-renders on sidebar resize. */
export function useMobileDrawer(): MobileDrawerContextValue {
  const drawer = React.useContext(MobileDrawerContext);
  if (!drawer) throw new Error('useMobileDrawer must be used within a MainSidebarProvider.');
  return drawer;
}
