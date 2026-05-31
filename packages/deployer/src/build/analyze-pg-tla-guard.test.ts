import { describe, expect, it } from 'vitest';
import { CO_EXTERNALS } from './analyze/constants';
import { isDependencyPartOfPackage } from './utils';

function applyCoExternals(userExternals: string[], externalsPreset: boolean): string[] {
  const coRequired = externalsPreset
    ? []
    : CO_EXTERNALS.filter(r => userExternals.some(e => isDependencyPartOfPackage(e, r.trigger))).flatMap(
        r => r.requires,
      );
  return coRequired.length ? [...userExternals, ...new Set(coRequired)] : userExternals;
}

describe('CO_EXTERNALS pg TLA guardrail', () => {
  it('appends @mastra/core/storage when @mastra/pg is externalized', () => {
    expect(applyCoExternals(['@mastra/pg'], false)).toContain('@mastra/core/storage');
  });

  it('appends @mastra/core/storage when @mastra/store-pg is externalized', () => {
    expect(applyCoExternals(['@mastra/store-pg'], false)).toContain('@mastra/core/storage');
  });

  it('does not append when no pg package is present', () => {
    expect(applyCoExternals(['some-other-package', '@mastra/core'], false)).not.toContain('@mastra/core/storage');
    expect(applyCoExternals([], false)).not.toContain('@mastra/core/storage');
  });

  it('skips the guard when externalsPreset is true', () => {
    expect(applyCoExternals(['@mastra/pg'], true)).not.toContain('@mastra/core/storage');
  });

  it('preserves original externals when guard entry is appended', () => {
    const result = applyCoExternals(['@mastra/pg', 'some-other-package'], false);
    expect(result).toContain('@mastra/pg');
    expect(result).toContain('some-other-package');
  });
});
