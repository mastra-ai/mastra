import { useContext } from 'react';

import { BoardRowDetailsContext } from './BoardRowDetailsContext';

export function useBoardRowDetails(): (open: boolean) => void {
  const setRowDetailsOpen = useContext(BoardRowDetailsContext);
  if (!setRowDetailsOpen) throw new Error('useBoardRowDetails must be used within VirtualBoardWindow');
  return setRowDetailsOpen;
}
