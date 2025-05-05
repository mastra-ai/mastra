import React, { createContext, useContext } from 'react';

export const TraceDurationContext = createContext<number>(0);

export const useTraceDuration = () => {
  return useContext(TraceDurationContext);
};

export interface TraceDurationProviderProps {
  children: React.ReactNode;
  durationMs: number;
}

export const TraceDurationProvider = ({ children, durationMs }: TraceDurationProviderProps) => {
  return <TraceDurationContext.Provider value={durationMs}>{children}</TraceDurationContext.Provider>;
};
