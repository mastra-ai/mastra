import { createContext } from 'react';

export interface BoardRowDetails {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const BoardRowDetailsContext = createContext<BoardRowDetails | null>(null);
