import { createContext } from 'react';
import type { RefObject } from 'react';

export const ArrayItemPathContext = createContext('');
export const FormReadOnlyContext = createContext(false);

export const ArrayAddButtonContext = createContext<RefObject<HTMLButtonElement | null> | undefined>(undefined);

export const ROOT_FIELD_KEY = '\u200B';
