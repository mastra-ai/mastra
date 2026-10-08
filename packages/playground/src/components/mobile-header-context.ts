import { createContext } from 'react';

export const MobileHeaderContext = createContext<{ page: HTMLDivElement; navigation: HTMLDivElement } | undefined>(
  undefined,
);
