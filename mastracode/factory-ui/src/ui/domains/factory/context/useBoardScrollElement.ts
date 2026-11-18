import { useContext } from 'react';

import { BoardScrollContext } from './BoardScrollContext';

export function useBoardScrollElement(): HTMLDivElement | null {
  const scrollElement = useContext(BoardScrollContext);
  if (scrollElement === undefined) throw new Error('useBoardScrollElement must be used within BoardStages');
  return scrollElement;
}
