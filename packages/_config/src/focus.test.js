import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Linter } from 'eslint';
import { restrictedFocusSelectors } from './focus.js';

function lintFocusStyles(source) {
  return new Linter().verify(source, {
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: { 'no-restricted-syntax': ['error', ...restrictedFocusSelectors] },
  });
}

describe('Feature focus policy', () => {
  describe('when a control suppresses its outline', () => {
    it('rejects plain and variant utilities', () => {
      for (const className of ['outline-none', 'focus-visible:outline-hidden', 'focus:outline-none!']) {
        const messages = lintFocusStyles(`<button className="${className}" />;`);
        assert.equal(messages.length, 1);
        assert.equal(messages[0].ruleId, 'no-restricted-syntax');
      }
    });

    it('rejects an inline outline reset', () => {
      assert.equal(lintFocusStyles('<button style={{ outline: "none" }} />;').length, 1);
    });
  });

  describe('when a control defines a separate focus ring', () => {
    it('rejects template strings and pseudo-element rings', () => {
      for (const className of ['focus-visible:ring-2', 'focus-visible:after:ring-accent1', 'focus:shadow-lg']) {
        const messages = lintFocusStyles('const classes = `' + className + '`;');
        assert.equal(messages.length, 1);
        assert.equal(messages[0].ruleId, 'no-restricted-syntax');
      }
    });
  });

  describe('when a control uses the shared focus contract', () => {
    it('allows shared treatments, focus visibility, and hover decoration', () => {
      const messages = lintFocusStyles(
        '<button className="ds-focus ds-focus-line focus-visible:opacity-100 hover:ring-2" />;',
      );
      assert.deepEqual(messages, []);
    });
  });
});
