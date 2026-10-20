import { useContext } from 'react';

import type { BoardRowDetails } from './BoardRowDetailsContext';
import { BoardRowDetailsContext } from './BoardRowDetailsContext';

export function useBoardRowDetails(): BoardRowDetails {
  const rowDetails = useContext(BoardRowDetailsContext);
  if (!rowDetails) throw new Error('useBoardRowDetails must be used within VirtualBoardWindow');
  return rowDetails;
}
