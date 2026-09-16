import React from 'react';

export type SidebarNewNavStackContextValue = {
  activeValue: string;
  rootValue: string;
  closeView: (returnFocusRef?: React.RefObject<HTMLElement | null>) => void;
};

export const SidebarNewNavStackContext = React.createContext<SidebarNewNavStackContextValue | undefined>(undefined);

export function useSidebarNewNavStack() {
  const context = React.useContext(SidebarNewNavStackContext);
  if (!context) throw new Error('SidebarNew.NavStack components must be used within SidebarNew.NavStack.');
  return context;
}
