import { createContext } from 'react';
import type { RefObject } from 'react';

/** Every stage uses the board's single scroll container, including grouped lists. */
export const BoardScrollContext = createContext<RefObject<HTMLDivElement | null> | undefined>(undefined);
