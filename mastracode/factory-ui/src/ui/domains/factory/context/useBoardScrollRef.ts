import { useContext } from 'react';
import type { RefObject } from 'react';

import { BoardScrollContext } from './BoardScrollContext';

export function useBoardScrollRef(): RefObject<HTMLDivElement | null> {
  const scrollRef = useContext(BoardScrollContext);
  if (!scrollRef) throw new Error('useBoardScrollRef must be used within BoardStages');
  return scrollRef;
}
