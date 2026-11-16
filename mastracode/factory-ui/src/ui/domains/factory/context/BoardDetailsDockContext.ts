import { createContext } from 'react';

export interface BoardDetailsDock {
  /** Null for the first frame, until the dock's column mounts. */
  element: HTMLElement | null;
}

export const BoardDetailsDockContext = createContext<BoardDetailsDock | null>(null);
