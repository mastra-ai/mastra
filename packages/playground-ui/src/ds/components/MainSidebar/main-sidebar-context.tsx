import React from 'react';

const SIDEBAR_COOKIE_NAME = 'sidebar:state';

export type SidebarState = 'default' | 'collapsed';

type MainSidebarContext = {
  state: SidebarState;
  toggleSidebar: () => void;
  /** Whether expansion is disabled (sidebar locked in collapsed state) */
  isExpansionDisabled: boolean;
};

const MainSidebarContext = React.createContext<MainSidebarContext | null>(null);

export function useMainSidebar() {
  const context = React.useContext(MainSidebarContext);
  if (!context) {
    throw new Error('useMainSidebar must be used within a MainSidebarProvider.');
  }

  return context;
}

export function useMaybeSidebar(): MainSidebarContext | null {
  return React.useContext(MainSidebarContext);
}

const setLocalStorage = (value: SidebarState) => {
  window.localStorage.setItem(SIDEBAR_COOKIE_NAME, value.toString());
};

export type MainSidebarProviderProps = {
  children: React.ReactNode;
  /** Force the sidebar to stay collapsed and disable expansion */
  forceCollapsed?: boolean;
};

export function MainSidebarProvider({ children, forceCollapsed = false }: MainSidebarProviderProps) {
  // Always start with 'default' to prevent hydration mismatch
  const [internalState, setInternalState] = React.useState<SidebarState>(() => 'default');

  // Sync with localStorage after hydration
  React.useLayoutEffect(() => {
    const storedState = window.localStorage.getItem(SIDEBAR_COOKIE_NAME);
    if (storedState === 'collapsed' || storedState === 'default') {
      setInternalState(storedState);
    }
  }, []);

  // When forceCollapsed is true, always return 'collapsed' state
  const state: SidebarState = forceCollapsed ? 'collapsed' : internalState;

  const toggleSidebar = React.useCallback(() => {
    // Don't allow toggling if expansion is disabled
    if (forceCollapsed) {
      return;
    }
    setLocalStorage(internalState === 'default' ? 'collapsed' : 'default');
    setInternalState(internalState === 'default' ? 'collapsed' : 'default');
  }, [internalState, forceCollapsed]);

  const contextValue = React.useMemo<MainSidebarContext>(
    () => ({
      state,
      toggleSidebar,
      isExpansionDisabled: forceCollapsed,
    }),
    [state, toggleSidebar, forceCollapsed],
  );

  return <MainSidebarContext.Provider value={contextValue}>{children}</MainSidebarContext.Provider>;
}
