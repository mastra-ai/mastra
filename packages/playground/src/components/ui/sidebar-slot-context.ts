import { createContext, useContext } from 'react';
import type { RefCallback } from 'react';

export const SidebarSlotContext = createContext<
  { target: HTMLDivElement; registerTarget: RefCallback<HTMLDivElement> } | undefined
>(undefined);

export const useSidebarSlot = () => useContext(SidebarSlotContext);
