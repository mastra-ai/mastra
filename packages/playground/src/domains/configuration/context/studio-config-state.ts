import { createContext, useContext } from 'react';

import type { StudioConfig } from '../types';

export type StudioConfigContextType = StudioConfig & {
  isLoading: boolean;
  setConfig: (partialNewConfig: Partial<StudioConfig>) => void;
};

export const StudioConfigContext = createContext<StudioConfigContextType>({
  baseUrl: '',
  headers: {},
  apiPrefix: undefined,
  isLoading: false,
  setConfig: () => {},
});

export const useStudioConfig = () => {
  return useContext(StudioConfigContext);
};
