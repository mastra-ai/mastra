import { useContext } from 'react';
import { SidebarCollapseContext } from './sidebar-collapse-context';

export function useSidebarCollapse() {
  const ctx = useContext(SidebarCollapseContext);
  if (!ctx) {
    throw new Error('useSidebarCollapse must be used inside a <SidebarCollapseProvider>.');
  }
  return ctx;
}
