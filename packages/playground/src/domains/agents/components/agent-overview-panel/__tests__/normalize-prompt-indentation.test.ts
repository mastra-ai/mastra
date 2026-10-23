import { describe, expect, it } from 'vitest';
import { normalizePromptIndentation } from '../normalize-prompt-indentation';

describe('normalizePromptIndentation', () => {
  describe.each(['      ', '\t', '\t  '])('when every nonblank line shares the prefix %j', indentation => {
    it('removes the shared margin and preserves nested lists and code indentation', () => {
      const markdown = 'Instructions:\n\n- First\n  - Nested\n\n    indented code\n\n```ts\n\treturn 1;\n```';
      const instructions = `\n${markdown
        .split('\n')
        .map(line => `${indentation}${line}`)
        .join('\n')}\n`;

      expect(normalizePromptIndentation(instructions)).toBe(`\n${markdown}\n`);
    });
  });

  describe('when instructions already start at the left margin', () => {
    it('preserves intentional indented code, tabs, and trailing whitespace', () => {
      const instructions = 'Example:  \n\n    code\n\tmore code\n';

      expect(normalizePromptIndentation(instructions)).toBe(instructions);
    });
  });

  describe('when tabs and spaces have no shared prefix', () => {
    it('leaves the indentation intact rather than guessing at equivalent tab widths', () => {
      const instructions = '\tFirst\n    Second';

      expect(normalizePromptIndentation(instructions)).toBe(instructions);
    });
  });

  describe('when instructions use Windows line endings', () => {
    it('preserves the line endings while removing the common margin', () => {
      expect(normalizePromptIndentation('\r\n\tFirst\r\n\tSecond\r\n')).toBe('\r\nFirst\r\nSecond\r\n');
    });
  });

  describe.each(['', ' \t\n  \n'])('when instructions contain no text: %j', instructions => {
    it('keeps the original content', () => {
      expect(normalizePromptIndentation(instructions)).toBe(instructions);
    });
  });
});
