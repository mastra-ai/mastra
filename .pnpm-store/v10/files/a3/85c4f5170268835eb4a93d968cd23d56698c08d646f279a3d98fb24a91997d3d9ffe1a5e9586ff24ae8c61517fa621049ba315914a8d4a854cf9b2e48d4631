import type { WithAsProp } from './types.js';
export type CodeProps<T extends React.ElementType> = WithAsProp<T, {
    children: React.ReactNode | ((data: {
        isLineHighlighted: boolean;
        lineNumber: number;
    }, idx: number) => React.ReactNode);
}>;
export type LineContentProps<T extends React.ElementType> = WithAsProp<T, {}>;
export type LineNumberProps<T extends React.ElementType> = WithAsProp<T, {}>;
