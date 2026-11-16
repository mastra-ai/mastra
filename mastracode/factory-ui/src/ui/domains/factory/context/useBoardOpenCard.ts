import { useContext } from 'react';

import type { BoardOpenCard } from './BoardOpenCardContext';
import { BoardOpenCardContext } from './BoardOpenCardContext';

export function useBoardOpenCard(): BoardOpenCard {
  const openCard = useContext(BoardOpenCardContext);
  if (!openCard) throw new Error('useBoardOpenCard must be used within BoardStages');
  return openCard;
}
