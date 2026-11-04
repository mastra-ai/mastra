import { copySources } from './copy-sources.js';

export const noTextSeparators = {
  meta: { type: 'suggestion', schema: false },
  create(context) {
    return copySources(context, (node, { text, separator }) => {
      if (text.trim() === '—' && !separator) return;
      if (!/[·—]|(?:^|\s)(?:[|•∙]|--)(?=\s|$)|(?:^|\s)-\s/.test(text)) return;
      context.report({
        node,
        message: 'Use separate elements and a layout gap for metadata; use normal sentence punctuation for prose.',
      });
    });
  },
};

export const noTextLayoutSpacing = {
  meta: { type: 'suggestion', schema: false },
  create(context) {
    return copySources(context, (node, { text }) => {
      const withoutIndentation = text.replace(/(\r?\n)[ \t]+/g, '$1');
      if (!/[ \t\u00a0]{2,}|\t/.test(withoutIndentation)) return;
      context.report({
        node,
        message: 'Use a layout gap between separate elements instead of repeated spaces in copy.',
      });
    });
  },
};
