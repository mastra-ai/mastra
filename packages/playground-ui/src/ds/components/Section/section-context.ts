import { createContext, useContext } from 'react';

export type SectionVariant = 'default' | 'flat' | 'factory';

const SectionContext = createContext<SectionVariant>('default');

export const SectionProvider = SectionContext.Provider;

export function useSectionVariant() {
  return useContext(SectionContext);
}
