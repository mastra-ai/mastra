import { describe, expect, it } from 'vitest';

import { formatQuotedMessage, normalizeQuote } from './format-quoted-message';

describe('formatQuotedMessage', () => {
  describe('when no annotations were added', () => {
    it('sends the typed text unchanged', () => {
      expect(formatQuotedMessage('  keep my spacing ', [])).toBe('  keep my spacing ');
    });
  });

  describe('when one annotation spans several paragraphs', () => {
    it('keeps every line inside the numbered item, blank lines included', () => {
      expect(formatQuotedMessage('Why?', [{ text: 'First line\nsecond line\n\nNew paragraph' }])).toBe(
        '1. > First line\n   > second line\n   >\n   > New paragraph\n\nWhy?',
      );
    });
  });

  describe('when two annotations are added', () => {
    it('numbers them in the order added, as the transcript marks show them', () => {
      expect(formatQuotedMessage('Compare these', [{ text: 'Open rows' }, { text: 'Soft rows' }])).toBe(
        '1. > Open rows\n\n2. > Soft rows\n\nCompare these',
      );
    });
  });

  describe('when an annotation carries a comment', () => {
    it('puts the comment inside that item, so it stays apart from the typed message', () => {
      expect(
        formatQuotedMessage('Anything else?', [
          { text: 'Open rows', comment: 'Make this the default.' },
          { text: 'Soft rows', comment: 'Drop it.\n\nWe never ship it.' },
        ]),
      ).toBe(
        '1. > Open rows\n\n   Make this the default.\n\n2. > Soft rows\n\n   Drop it.\n\n   We never ship it.\n\nAnything else?',
      );
    });
  });

  describe('when there are ten or more annotations', () => {
    it('indents continuation lines past the wider number', () => {
      const quotes = Array.from({ length: 10 }, (_, index) => ({ text: `Line ${index + 1}` }));
      quotes[9] = { text: 'Ten\nstill ten' };

      expect(formatQuotedMessage('', quotes).split('\n\n').at(-1)).toBe('10. > Ten\n    > still ten');
    });
  });

  describe('when the person typed nothing', () => {
    it('sends only the annotations, without a trailing blank line', () => {
      expect(formatQuotedMessage('  ', [{ text: 'Open rows' }])).toBe('1. > Open rows');
    });
  });

  describe('when an annotation holds only whitespace', () => {
    it('drops it instead of sending an empty item', () => {
      expect(formatQuotedMessage('Hi', [{ text: ' \n\t' }])).toBe('Hi');
    });
  });

  describe('when a comment holds only whitespace', () => {
    it('sends the passage without an empty comment', () => {
      expect(formatQuotedMessage('Hi', [{ text: 'Open rows', comment: '  \n ' }])).toBe('1. > Open rows\n\nHi');
    });
  });
});

describe('normalizeQuote', () => {
  describe('when a selection was copied from Windows-style text with ragged spacing', () => {
    it('unifies line endings, trims each line end, and collapses runs of blank lines', () => {
      expect(normalizeQuote('\r\n  Alpha  \r\n\r\n\r\n\r\nBeta\t\r\n')).toBe('Alpha\n\nBeta');
    });
  });

  describe('when a line is indented, as in a code block', () => {
    it('keeps the indentation of every line after the first', () => {
      expect(normalizeQuote('if (ok) {\n  run();\n}')).toBe('if (ok) {\n  run();\n}');
    });
  });
});
