import { createContext } from 'react';

export const BoardRowDetailsContext = createContext<((open: boolean) => void) | null>(null);
