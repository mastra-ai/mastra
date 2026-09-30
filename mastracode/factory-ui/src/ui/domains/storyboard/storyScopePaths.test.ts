import { describe, expect, it } from 'vitest';

import { scopeOf, switchScopePath } from './storyScopePaths';

describe('settings scope lives in the URL', () => {
  it('reads the asked scope on a two-scope section', () => {
    expect(scopeOf('models', 'factory')).toBe('factory');
    expect(scopeOf('models', null)).toBe('personal');
  });

  it('derives the scope of a one-scope section, ignoring a scope it lacks', () => {
    expect(scopeOf('repositories', null)).toBe('factory');
    expect(scopeOf('account', 'factory')).toBe('personal');
  });

  it('stays on a two-scope section and leaves a one-scope one', () => {
    expect(switchScopePath('f1', 'models', 'factory')).toBe('/factories/f1/settings/models?scope=factory');
    expect(switchScopePath('f1', 'account', 'factory')).toBe('/factories/f1/settings/models?scope=factory');
    expect(switchScopePath('f1', 'intake', 'personal')).toBe('/factories/f1/settings/account?scope=personal');
  });
});
