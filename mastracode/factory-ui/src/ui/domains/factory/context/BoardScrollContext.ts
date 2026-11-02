import { createContext } from 'react';
import type { RefObject } from 'react';

export const BoardScrollContext = createContext<RefObject<HTMLDivElement | null> | null>(null);
