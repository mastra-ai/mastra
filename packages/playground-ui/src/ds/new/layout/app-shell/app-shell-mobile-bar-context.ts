import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type AppShellMobileBar = {
  brand?: ReactNode;
  actions?: ReactNode;
};

export const AppShellMobileBarContext = createContext<AppShellMobileBar | undefined>(undefined);

export function useAppShellMobileBar() {
  return useContext(AppShellMobileBarContext);
}
