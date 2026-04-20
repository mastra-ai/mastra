/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

const STORAGE_KEY = 'agent-sidebar-collapsed';

export interface SidebarCollapseContextValue {
  collapsed: boolean;
  collapse: () => void;
  expand: () => void;
  toggle: () => void;
}

export const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null);

function getInitialState(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(getInitialState);

  const persist = useCallback((value: boolean) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const collapse = useCallback(() => {
    setCollapsed(true);
    persist(true);
  }, [persist]);

  const expand = useCallback(() => {
    setCollapsed(false);
    persist(false);
  }, [persist]);

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      persist(next);
      return next;
    });
  }, [persist]);

  const value = useMemo(() => ({ collapsed, collapse, expand, toggle }), [collapsed, collapse, expand, toggle]);

  return <SidebarCollapseContext.Provider value={value}>{children}</SidebarCollapseContext.Provider>;
}
