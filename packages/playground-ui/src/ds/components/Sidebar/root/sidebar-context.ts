import React from 'react';
import type { LinkComponent } from '@/ds/types/link-component';

export type SidebarState = 'default' | 'collapsed';

/** Which way the panel is animating between widths, while it does. */
export type SidebarMotion = 'collapsing' | 'expanding';

export type SidebarSwitchOptions = {
  /** Animate with the panel's width (the toggle's collapse), instead of switching at once. */
  animate?: boolean;
};

type SidebarContextValue = {
  state: SidebarState;
  desktopState: SidebarState;
  width: number;
  minWidth: number;
  maxWidth: number;
  collapseBelow: number;
  collapsedWidth: number;
  isMobile: boolean;
  openMobile: boolean;
  mobileTriggerRef: React.RefObject<HTMLButtonElement | null>;
  setOpenMobile: (open: boolean) => void;
  setMobileDrawerPresent: (present: boolean) => void;
  toggleSidebar: () => void;
  setWidth: (width: number) => void;
  collapse: (options?: SidebarSwitchOptions) => void;
  expand: (options?: SidebarSwitchOptions) => void;
  commit: () => void;
  setGestureActive: (active: boolean) => void;
  /** Which way the panel is animating between widths, while it does. */
  motion?: SidebarMotion;
  /** The desktop panel registers its element here: its width variable is written on it, not on the provider's
   * scope, which wraps the whole app (a variable change there restyles every element on the page). */
  setPanelElement: (el: HTMLDivElement | null) => void;
  LinkComponent?: LinkComponent;
};

// Split: drawer open-state lives in its own context so navigation rows
// do not re-render when the mobile drawer toggles.
export type MobileDrawerContextValue = {
  openMobile: boolean;
  mobileTriggerRef: React.RefObject<HTMLButtonElement | null>;
  setOpenMobile: (open: boolean) => void;
  setMobileDrawerPresent: (present: boolean) => void;
};

export type SidebarStateContextValue = Omit<
  SidebarContextValue,
  'openMobile' | 'mobileTriggerRef' | 'setOpenMobile' | 'setMobileDrawerPresent'
>;

export const SidebarContext = React.createContext<SidebarStateContextValue | null>(null);
export const MobileDrawerContext = React.createContext<MobileDrawerContextValue | null>(null);

/** Reads sidebar state and actions without subscribing to mobile drawer state. */
export function useMaybeSidebarState(): SidebarStateContextValue | null {
  return React.useContext(SidebarContext);
}

export function useSidebar(): SidebarContextValue {
  const ctx = React.useContext(SidebarContext);
  const drawer = React.useContext(MobileDrawerContext);
  if (!ctx || !drawer) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }
  return { ...ctx, ...drawer };
}

export function useMaybeSidebar(): SidebarContextValue | null {
  const ctx = React.useContext(SidebarContext);
  const drawer = React.useContext(MobileDrawerContext);
  if (!ctx || !drawer) return null;
  return { ...ctx, ...drawer };
}

/** Reads only mobile drawer state. Cheap — no re-renders on sidebar resize. */
export function useMobileDrawer(): MobileDrawerContextValue {
  const drawer = React.useContext(MobileDrawerContext);
  if (!drawer) throw new Error('useMobileDrawer must be used within a SidebarProvider.');
  return drawer;
}
