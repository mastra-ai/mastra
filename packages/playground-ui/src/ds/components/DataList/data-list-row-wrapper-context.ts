import { createContext, useContext } from 'react';

export const DataListRowWrapperContext = createContext(false);

export function useDataListRowWrapperContext() {
  return useContext(DataListRowWrapperContext);
}
