import { describe, expect, it } from 'vitest';

import config from '../tsdown.config';

// Guards the CJS/ESM packaging split for ESM-only type stripping (#24357):
// ts-blank-space (and the `typescript` API it runs on) cannot be required()
// from CJS, so the CJS build must bundle them while ESM keeps them external.
describe('tsdown packaging split', () => {
  const entries = Array.isArray(config) ? config : [config];
  const formats = (entry: unknown): string[] => {
    const format = (entry as { format?: string | string[] }).format;
    return Array.isArray(format) ? format : format ? [format] : [];
  };
  const depsOf = (entry: unknown) => (entry as { deps?: Record<string, unknown> }).deps ?? {};

  it('bundles ts-blank-space and typescript into the CJS output', () => {
    const cjs = entries.filter(entry => formats(entry).includes('cjs'));
    expect(cjs.length).toBeGreaterThan(0);
    for (const entry of cjs) {
      const deps = depsOf(entry);
      expect(deps).toMatchObject({ alwaysBundle: expect.arrayContaining(['ts-blank-space', 'typescript']) });
      expect(deps.neverBundle ?? []).not.toContain('ts-blank-space');
    }
  });

  it('keeps ts-blank-space external in the ESM output', () => {
    const esm = entries.filter(entry => formats(entry).includes('esm'));
    expect(esm.length).toBeGreaterThan(0);
    for (const entry of esm) {
      expect(depsOf(entry).neverBundle ?? []).toContain('ts-blank-space');
    }
  });
});
