import { type HighlightProps } from 'prism-react-renderer';
import React from 'react';
import type { CodeProps, LineContentProps, LineNumberProps } from './shared/prop-types.js';
import type { WithAsProp, WithDisplayName } from './shared/types.js';
export interface CodeBlockProps extends Omit<HighlightProps, 'children'> {
    lines?: (number | string)[];
    words?: string[];
    children: React.ReactNode;
}
/**
 * Top-level root component which contains all the sub-components to construct a code block.
 *
 * API Reference: {@link https://react-code-block.netlify.app/api-reference#codeblock}
 */
declare const CodeBlock: {
    ({ code, words, lines, children, ...props }: CodeBlockProps): import("react/jsx-runtime").JSX.Element;
    /**
     * Container which contains code to render each line of the code.
     *
     * API Reference: {@link https://react-code-block.netlify.app/api-reference#codeblockcode}
     */
    Code: CodeComponent;
    /**
     * Container for a single line of the code.
     *
     * API Reference: {@link https://react-code-block.netlify.app/api-reference#codeblocklinecontent}
     */
    LineContent: LineContentComponent;
    /**
     * Renders a syntax-highlighted token from the current line.
     *
     * API Reference: {@link https://react-code-block.netlify.app/api-reference#codeblocktoken}
     */
    Token: TokenComponent;
    /**
     * Renders the line number for the current line.
     *
     * API Reference: {@link https://react-code-block.netlify.app/api-reference#codeblocklinenumber}
     */
    LineNumber: LineNumberComponent;
};
export type TokenProps<T extends React.ElementType> = WithAsProp<T, {
    children?: (data: {
        isTokenHighlighted: boolean;
        children: React.ReactNode;
    }) => React.ReactNode;
}>;
interface CodeComponent extends WithDisplayName {
    <U, T extends React.ElementType = 'pre'>(props: CodeProps<T> & {
        ref?: U;
    }): JSX.Element;
}
interface LineContentComponent extends WithDisplayName {
    <U, T extends React.ElementType = 'div'>(props: LineContentProps<T> & {
        ref?: U;
    }): JSX.Element;
}
interface TokenComponent extends WithDisplayName {
    <U, T extends React.ElementType = 'span'>(props: TokenProps<T> & {
        ref?: U;
    }): JSX.Element;
}
interface LineNumberComponent extends WithDisplayName {
    <U, T extends React.ElementType = 'span'>(props: LineNumberProps<T> & {
        ref?: U;
    }): JSX.Element;
}
export { CodeBlock };
