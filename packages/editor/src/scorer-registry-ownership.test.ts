import { describe, expect, it } from 'vitest';

import { isStoredScorerRegistration } from './scorer-registry-ownership';

describe('isStoredScorerRegistration', () => {
  it('identifies a stored scorer at the requested registration key', () => {
    expect(isStoredScorerRegistration({ quality: { id: 'quality', source: 'stored' } }, 'quality')).toBe(true);
  });

  it('does not claim a code-defined scorer at the requested key', () => {
    expect(isStoredScorerRegistration({ quality: { id: 'quality', source: 'code' } }, 'quality')).toBe(false);
  });

  it('does not claim a code scorer under another key that shares the stored ID', () => {
    expect(isStoredScorerRegistration({ custom: { id: 'quality', source: 'code' } }, 'quality')).toBe(false);
  });

  it('returns false when no scorer is registered at the key', () => {
    expect(isStoredScorerRegistration(undefined, 'quality')).toBe(false);
    expect(isStoredScorerRegistration({}, 'quality')).toBe(false);
  });
});
