import { afterEach, describe, expect, it } from 'vitest';

import { clearMastraCodeStorage } from '../auth';

describe('clearMastraCodeStorage', () => {
  afterEach(() => localStorage.clear());

  it('removes MastraCode-owned keys without deleting unrelated same-origin data', () => {
    localStorage.setItem('mastracode-legacy-cache', '[]');
    localStorage.setItem('mastracode-active-factory', 'factory-1');
    localStorage.setItem('mastracode.theme', 'dark');
    localStorage.setItem('mastracode-web', 'expanded');
    localStorage.setItem('unrelated-app', 'preserve-me');

    clearMastraCodeStorage();

    expect(localStorage.getItem('mastracode-legacy-cache')).toBeNull();
    expect(localStorage.getItem('mastracode-active-factory')).toBeNull();
    expect(localStorage.getItem('mastracode.theme')).toBeNull();
    expect(localStorage.getItem('mastracode-web')).toBeNull();
    expect(localStorage.getItem('unrelated-app')).toBe('preserve-me');
  });
});
