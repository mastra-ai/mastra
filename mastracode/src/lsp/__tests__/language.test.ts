import { describe, expect, it } from 'vitest';

import { getLanguageId } from '../language';

describe('getLanguageId', () => {
  it.each([
    ['src/index.ts', 'typescript'],
    ['src/component.tsx', 'typescriptreact'],
    ['src/index.js', 'javascript'],
    ['src/component.jsx', 'javascriptreact'],
  ])('maps %s to %s instead of the raw extension', (filePath, languageId) => {
    expect(getLanguageId(filePath)).toBe(languageId);
    expect(getLanguageId(filePath)).not.toBe(filePath.slice(filePath.lastIndexOf('.') + 1));
  });
});
