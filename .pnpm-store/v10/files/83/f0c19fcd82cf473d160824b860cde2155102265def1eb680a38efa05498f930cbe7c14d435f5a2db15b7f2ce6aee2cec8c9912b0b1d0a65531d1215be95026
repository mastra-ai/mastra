import { jsx as _jsx } from "react/jsx-runtime";
import React, { useMemo } from 'react';
import {} from 'shiki';
import { fontStyleToCss, forwardRef, parseWordHighlights, shouldHighlightLine, shouldHighlightToken, splitStringByWords, } from '../shared/utils.js';
import { ShikiLineContext, ShikiRootContext, useLineContext, useRootContext, } from './contexts.js';
/**
 * Top-level root component which contains all the sub-components to construct a code block.
 *
 * API Reference: {@link https://react-code-block.netlify.app/api-reference#codeblock}
 */
const CodeBlock = ({ tokens, words = [], lines = [], children, ...props }) => {
    const parsedWords = useMemo(() => parseWordHighlights(words), [words]);
    return (_jsx(ShikiRootContext.Provider, { value: { tokens, words: parsedWords, lines, ...props }, children: children }));
};
const Code = ({ as, children, ...props }, ref) => {
    const { tokens, lines } = useRootContext();
    const Tag = as ?? 'pre';
    return (_jsx(Tag, { ...props, ref: ref, children: tokens.tokens.map((line, i) => {
            const lineNumber = i + 1;
            const isLineHighlighted = shouldHighlightLine(lineNumber, lines);
            return (_jsx(ShikiLineContext.Provider, { value: { line, lineNumber }, children: typeof children === 'function'
                    ? children({ isLineHighlighted, lineNumber }, i)
                    : children }, i));
        }) }));
};
const LineContent = ({ as, style, ...rest }, ref) => {
    const { tokens } = useRootContext();
    const Tag = as ?? 'div';
    return (_jsx(Tag, { ...rest, ref: ref, style: { ...style, color: tokens.fg } }));
};
const Token = ({ as, children = ({ children }) => _jsx("span", { children: children }), className, style, ...rest }, ref) => {
    const { words } = useRootContext();
    const { line, lineNumber } = useLineContext();
    const Tag = as ?? 'span';
    return (_jsx(React.Fragment, { children: line.map((token, key) => {
            const content = words.length
                ? splitStringByWords(token.content, words)
                : [token.content];
            return (_jsx(React.Fragment, { children: content.map((content, i) => (_jsx(Tag, { style: {
                        color: token.color,
                        backgroundColor: token.bgColor,
                        ...fontStyleToCss(token),
                        ...style,
                    }, ...token.htmlAttrs, ...rest, ref: ref, children: children({
                        children: content,
                        token,
                        isTokenHighlighted: shouldHighlightToken(content, lineNumber, words),
                    }) }, i))) }, key));
        }) }));
};
const LineNumber = ({ as, ...props }, ref) => {
    const { lineNumber } = useLineContext();
    const Tag = as ?? 'span';
    return (_jsx(Tag, { ...props, ref: ref, children: lineNumber }));
};
/**
 * Container which contains code to render each line of the code.
 *
 * API Reference: {@link https://react-code-block.netlify.app/api-reference#codeblockcode}
 */
CodeBlock.Code = forwardRef(Code);
/**
 * Container for a single line of the code.
 *
 * API Reference: {@link https://react-code-block.netlify.app/api-reference#codeblocklinecontent}
 */
CodeBlock.LineContent = forwardRef(LineContent);
/**
 * Renders a syntax-highlighted token from the current line.
 *
 * API Reference: {@link https://react-code-block.netlify.app/api-reference#codeblocktoken}
 */
CodeBlock.Token = forwardRef(Token);
/**
 * Renders the line number for the current line.
 *
 * API Reference: {@link https://react-code-block.netlify.app/api-reference#codeblocklinenumber}
 */
CodeBlock.LineNumber = forwardRef(LineNumber);
export { CodeBlock };
//# sourceMappingURL=code-block.js.map