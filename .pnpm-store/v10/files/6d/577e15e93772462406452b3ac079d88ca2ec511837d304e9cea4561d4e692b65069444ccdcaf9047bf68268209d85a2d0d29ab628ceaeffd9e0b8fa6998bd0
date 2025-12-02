import { type CSSProperties } from 'react';
import type { ThemedToken } from 'shiki';
import type { BaseContextProps } from './types.js';
export declare const shouldHighlightLine: (line: number, highlights: (number | string)[]) => boolean;
export declare const shouldHighlightToken: (word: string, line: number, highlights: BaseContextProps["words"]) => boolean;
export declare const splitStringByWords: (str: string, words: BaseContextProps["words"]) => string[];
export declare const parseWordHighlights: (words: string[]) => BaseContextProps["words"];
export declare const fontStyleToCss: (token: ThemedToken) => CSSProperties;
export declare const createUseContext: <T>(context: React.Context<T | undefined>, errMessage: string) => () => T & ({} | null);
export declare const forwardRef: <T extends {
    name: string;
    displayName?: string;
}>(component: T) => T & {
    displayName: string;
};
