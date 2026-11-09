import { createContext } from 'react';

export type StepsHeadingLevel = 2 | 3;

export const StepsHeadingContext = createContext<StepsHeadingLevel>(3);
