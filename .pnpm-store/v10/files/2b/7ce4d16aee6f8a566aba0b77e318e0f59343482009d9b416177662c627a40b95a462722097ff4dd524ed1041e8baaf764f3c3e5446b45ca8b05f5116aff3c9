import { useContext, forwardRef as reactForwardRef } from 'react';
export const shouldHighlightLine = (line, highlights) => {
    return highlights.some((highlight) => {
        if (typeof highlight === 'number') {
            return line === highlight;
        }
        const [min, max] = highlight.split(':').map((val) => parseInt(val));
        return min <= line && line <= max;
    });
};
export const shouldHighlightToken = (word, line, highlights) => {
    return highlights.some(([highlightWord, [min, max]]) => highlightWord === word && min <= line && line <= max);
};
export const splitStringByWords = (str, words) => {
    return str
        .split(new RegExp(`(${words.map(([word]) => word).join('|')})`))
        .filter(Boolean);
};
export const parseWordHighlights = (words) => {
    return words.map((word) => {
        word = word.startsWith('/') ? word : '/' + word;
        const [, highlightWord, highlightRange = '0:Infinity'] = word.split('/');
        const [min, max = min] = highlightRange
            .split(':')
            .map((val) => Number(val));
        return [highlightWord, [min, max]];
    });
};
export const fontStyleToCss = (token) => {
    const fontStyles = {};
    if (!token.fontStyle || token.fontStyle === -1)
        return fontStyles;
    if (token.fontStyle & 1) {
        fontStyles.fontStyle = 'italic';
    }
    if (token.fontStyle & 2) {
        fontStyles.fontWeight = 'bold';
    }
    if (token.fontStyle & 4) {
        fontStyles.textDecoration = `${fontStyles.textDecoration ?? ''} underline`.trim();
    }
    if (token.fontStyle & 8) {
        fontStyles.textDecoration = `${fontStyles.textDecoration ?? ''} line-through`.trim();
    }
    return fontStyles;
};
export const createUseContext = (context, errMessage) => () => {
    const ctx = useContext(context);
    if (ctx === undefined) {
        throw new Error(errMessage);
    }
    return ctx;
};
export const forwardRef = (component) => {
    return Object.assign(reactForwardRef(component), {
        displayName: component.displayName ?? component.name,
    });
};
//# sourceMappingURL=utils.js.map