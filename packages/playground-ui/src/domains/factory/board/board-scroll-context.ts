import { createContext, useContext } from 'react';

export const BoardScrollContext = createContext<HTMLDivElement | null | undefined>(undefined);

export function useBoardScrollElement(): HTMLDivElement | null {
  const scrollElement = useContext(BoardScrollContext);
  if (scrollElement === undefined) throw new Error('useBoardScrollElement must be used within BoardStages');
  return scrollElement;
}
