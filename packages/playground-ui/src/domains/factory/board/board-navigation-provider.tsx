import type { ReactNode } from 'react';
import { BoardNavigationContext } from './board-navigation';
import type { BoardNavigation } from './board-navigation';

export function BoardNavigationProvider({ value, children }: { value: BoardNavigation; children: ReactNode }) {
  return <BoardNavigationContext.Provider value={value}>{children}</BoardNavigationContext.Provider>;
}
