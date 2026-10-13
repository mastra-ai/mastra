import { createContext, useContext } from 'react';

export interface MobileHeaderSlotContextValue {
  slot: HTMLElement | null;
  setSlot: (slot: HTMLElement | null) => void;
}

/** Owned by `AppShell`: connects the mobile header (the slot) with the page rendered in the shell body. */
export const MobileHeaderSlotContext = createContext<MobileHeaderSlotContextValue | null>(null);

/** The element a page renders its header row into on mobile, or null when no `AppShellMobileHeader` is mounted. */
export function useMobileHeaderSlot() {
  return useContext(MobileHeaderSlotContext)?.slot ?? null;
}
