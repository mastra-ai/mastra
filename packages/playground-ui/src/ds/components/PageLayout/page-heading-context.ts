import { createContext, useContext } from 'react';

export const PageHeadingContext = createContext<string | undefined>(undefined);

export function usePageHeading() {
  return useContext(PageHeadingContext);
}
