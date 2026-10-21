import { createContext } from 'react';

export interface BoardOpenCard {
  openKey: string | undefined;
  setCardOpen: (key: string, open: boolean) => void;
}

export const BoardOpenCardContext = createContext<BoardOpenCard | null>(null);
