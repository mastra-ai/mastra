import { createContext, useContext } from 'react';

export interface MobileHeaderSlotContextValue {
  slot: HTMLElement | undefined;
  /** A ref callback, so it takes React's `null` on unmount. */
  setSlot: (slot: HTMLElement | null) => void;
}

/** Owned by `AppShell`: connects the mobile header (the slot) with the page rendered in the shell body. */
export const MobileHeaderSlotContext = createContext<MobileHeaderSlotContextValue | undefined>(undefined);

/** The element a page renders its header row into on mobile; undefined when no `AppShellMobileHeader` is mounted. */
export function useMobileHeaderSlot() {
  return useContext(MobileHeaderSlotContext)?.slot;
}
