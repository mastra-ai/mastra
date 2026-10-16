import { describe, expect, it } from 'vitest';

import { validateCustomVersionLabel } from '../agent-version-label-validation';

describe('validateCustomVersionLabel', () => {
  describe.each([
    ['one character', 'a'],
    ['all allowed separators internally', 'release.preview_1-candidate'],
    ['the maximum length', `a${'b'.repeat(62)}9`],
  ])('when the label has %s', (_condition, label) => {
    it('accepts the exact value', () => {
      expect(validateCustomVersionLabel(label, [])).toEqual({ valid: true });
    });
  });

  describe.each([
    ['empty', ''],
    ['longer than 64 characters', `a${'b'.repeat(63)}9`],
    ['uppercase ASCII', 'Release'],
    ['leading punctuation', '-release'],
    ['trailing punctuation', 'release-'],
    ['surrounding whitespace', ' release '],
    ['non-ASCII', 'préview'],
  ])('when the label is %s', (_condition, label) => {
    it('rejects the exact value without rewriting it', () => {
      expect(validateCustomVersionLabel(label, [])).toEqual({
        valid: false,
        message:
          'Use 1–64 lowercase ASCII letters, numbers, dots, underscores, or hyphens; start and end with a letter or number.',
      });
    });
  });

  describe.each(['production', 'PRODUCTION', 'latest', 'Latest'])('when %s is entered', label => {
    it('rejects the reserved name case-insensitively', () => {
      expect(validateCustomVersionLabel(label, [])).toEqual({
        valid: false,
        message: 'latest and production are reserved labels.',
      });
    });
  });

  describe('when the exact custom name already exists', () => {
    it('rejects the duplicate', () => {
      expect(validateCustomVersionLabel('preview', ['preview'])).toEqual({
        valid: false,
        message: 'The preview label already exists. Choose a different name.',
      });
    });
  });

  describe('when a different custom name exists', () => {
    it('accepts the new exact name', () => {
      expect(validateCustomVersionLabel('candidate', ['preview'])).toEqual({ valid: true });
    });
  });
});
