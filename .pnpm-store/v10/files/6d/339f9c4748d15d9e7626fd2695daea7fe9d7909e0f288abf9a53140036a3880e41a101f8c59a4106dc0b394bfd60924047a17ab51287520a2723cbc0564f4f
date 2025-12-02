import { jsx as _jsx } from "react/jsx-runtime";
import { Highlight } from 'prism-react-renderer';
import React, { useMemo } from 'react';
import { LineContext, RootContext, useLineContext, useRootContext, } from './contexts.js';
import { forwardRef, parseWordHighlights, shouldHighlightLine, shouldHighlightToken, splitStringByWords, } from './shared/utils.js';
/**
 * Top-level root component which contains all the sub-components to construct a code block.
 *
 * API Reference: {@link https://react-code-block.netlify.app/api-reference#codeblock}
 */
const CodeBlock = ({ code, words = [], lines = [], children, ...props }) => {
    const parsedWords = useMemo(() => parseWordHighlights(words), [words]);
    return (_jsx(RootContext.Provider, { value: { code: code.trim(), words: parsedWords, lines, ...props }, children: children }));
};
const Code = ({ as, children, ...props }, ref) => {
    const { lines, words, ...highlightProps } = useRootContext();
    const Tag = as ?? 'pre';
    return (_jsx(Highlight, { ...highlightProps, children: (highlight) => (_jsx(Tag, { ...props, ref: ref, children: highlight.tokens.map((line, i) => {
                const lineNumber = i + 1;
                const isLineHighlighted = shouldHighlightLine(lineNumber, lines);
                return (_jsx(LineContext.Provider, { value: { highlight, line, lineNumber }, children: typeof children === 'function'
                        ? children({ isLineHighlighted, lineNumber }, i)
                        : children }, i));
            }) })) }));
};
const LineContent = ({ as, children, className, ...rest }, ref) => {
    const { highlight, line } = useLineContext();
    const { getLineProps } = highlight;
    const Tag = as ?? 'div';
    return (_jsx(Tag, { ...getLineProps({ line, className }), ...rest, ref: ref, children: children }));
};
const Token = ({ as, children = ({ children }) => _jsx("span", { children: children }), className, ...rest }, ref) => {
    const { words } = useRootContext();
    const { line, highlight, lineNumber } = useLineContext();
    const { getTokenProps } = highlight;
    const Tag = as ?? 'span';
    return (_jsx(React.Fragment, { children: line.map((token, key) => {
            const { children: contentWithSpaces, ...props } = getTokenProps({
                token,
                className,
            });
            const content = words.length
                ? splitStringByWords(contentWithSpaces, words)
                : [contentWithSpaces];
            return (_jsx(React.Fragment, { children: content.map((content, i) => (_jsx(Tag, { ...props, ...rest, ref: ref, children: children({
                        children: content,
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