import { describe, expect, it } from 'vitest';

import { languageForPath } from './tool-call-language';

describe('languageForPath', () => {
  it('ignores file extensions inherited from the prototype chain', () => {
    expect(languageForPath('file.Object')).toBeUndefined();
  });
});
