import React from 'react';

export type SidebarNavStackContextValue = {
  activeValue: string;
  rootValue: string;
  closeView: (returnFocusRef?: React.RefObject<HTMLElement | null>) => void;
};

export const SidebarNavStackContext = React.createContext<SidebarNavStackContextValue | undefined>(undefined);

export function useSidebarNavStack() {
  const context = React.useContext(SidebarNavStackContext);
  if (!context) throw new Error('Sidebar.NavStack components must be used within Sidebar.NavStack.');
  return context;
}
