import { createContext, useContext } from 'react';

/** Set when a host app (Platform) renders Factory inside its own chrome. */
export interface FactoryEmbed {
  /** Host sidebar element the Factory navigation portals into. */
  sidebarContainer: HTMLElement | null;
}

export const FactoryEmbedContext = createContext<FactoryEmbed | null>(null);

export function useFactoryEmbed(): FactoryEmbed | null {
  return useContext(FactoryEmbedContext);
}
