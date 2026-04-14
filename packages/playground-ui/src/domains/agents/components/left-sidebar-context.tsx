import { createContext, useContext } from 'react';

export type LeftSidebarTab = 'conversations' | 'memory';

interface LeftSidebarTabContextValue {
  activeTab: LeftSidebarTab;
}

const LeftSidebarTabContext = createContext<LeftSidebarTabContextValue>({
  activeTab: 'conversations',
});

export const LeftSidebarTabProvider = LeftSidebarTabContext.Provider;

export function useLeftSidebarTab() {
  return useContext(LeftSidebarTabContext);
}
