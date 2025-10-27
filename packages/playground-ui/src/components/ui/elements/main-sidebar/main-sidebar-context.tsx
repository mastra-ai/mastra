import React from 'react';

const SIDEBAR_COOKIE_NAME = 'sidebar:state';

export type SidebarState = 'default' | 'collapsed';

type MainSidebarContext = {
  state: SidebarState;
  toggleSidebar: () => void;
};

const MainSidebarContext = React.createContext<MainSidebarContext | null>(null);

export function useMainSidebar() {
  const context = React.useContext(MainSidebarContext);
  if (!context) {
    throw new Error('useMainSidebar must be used within a MainSidebarProvider.');
  }

  return context;
}

function stateInitializer() {
  const storedState = window.localStorage.getItem(SIDEBAR_COOKIE_NAME);

  return storedState === 'collapsed' ? 'collapsed' : 'default';
}

const setLocalStorage = (value: SidebarState) => {
  window.localStorage.setItem(SIDEBAR_COOKIE_NAME, value.toString());
};

export function MainSidebarProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<SidebarState>(stateInitializer);

  const toggleSidebar = React.useCallback(() => {
    setLocalStorage(state === 'default' ? 'collapsed' : 'default');
    setState(state === 'default' ? 'collapsed' : 'default');
  }, [state]);

  const contextValue = React.useMemo<MainSidebarContext>(
    () => ({
      state,
      toggleSidebar,
    }),
    [state, toggleSidebar],
  );

  return <MainSidebarContext.Provider value={contextValue}>{children}</MainSidebarContext.Provider>;
}
