import { describe, expect, it } from 'vitest';

import { formatQuotedMessage, normalizeQuote } from './format-quoted-message';

describe('formatQuotedMessage', () => {
  describe('when no quotes were added', () => {
    it('sends the typed text unchanged', () => {
      expect(formatQuotedMessage('  keep my spacing ', [])).toBe('  keep my spacing ');
    });
  });

  describe('when one quote spans several paragraphs', () => {
    it('keeps every line inside one blockquote, blank lines included', () => {
      expect(formatQuotedMessage('Why?', ['First line\nsecond line\n\nNew paragraph'])).toBe(
        '> First line\n> second line\n>\n> New paragraph\n\nWhy?',
      );
    });
  });

  describe('when two quotes are added', () => {
    it('sends them as separate blockquotes in the order they were added', () => {
      expect(formatQuotedMessage('Compare these', ['Open rows', 'Soft rows'])).toBe(
        '> Open rows\n\n> Soft rows\n\nCompare these',
      );
    });
  });

  describe('when the person typed nothing', () => {
    it('sends only the quotes, without a trailing blank line', () => {
      expect(formatQuotedMessage('  ', ['Open rows'])).toBe('> Open rows');
    });
  });

  describe('when a quote holds only whitespace', () => {
    it('drops it instead of sending an empty blockquote', () => {
      expect(formatQuotedMessage('Hi', [' \n\t'])).toBe('Hi');
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
