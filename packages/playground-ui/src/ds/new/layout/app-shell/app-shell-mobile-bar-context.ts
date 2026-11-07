import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type AppShellMobileBar = {
  brand?: ReactNode;
  actions?: ReactNode;
};

export type AppShellMobileBarContextValue = AppShellMobileBar & {
  registerPageLayout: () => () => void;
};

export const AppShellMobileBarContext = createContext<AppShellMobileBarContextValue | undefined>(undefined);

export function useAppShellMobileBar() {
  return useContext(AppShellMobileBarContext);
}
