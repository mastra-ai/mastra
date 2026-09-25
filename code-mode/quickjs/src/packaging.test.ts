/**
 * Packaging guard for the ESM/CJS build split.
 *
 * `ts-blank-space` is an ESM-only package (`"type": "module"`, no `require`
 * export) and pulls in `typescript`. If the CJS build externalises either, the
 * emitted `require("ts-blank-space")` resolves to a namespace whose `.default`
 * is not callable on Node >=22.12, and every program fails at runtime with
 * `(0, ts_blank_space.default) is not a function` (older Node throws
 * `ERR_REQUIRE_ESM`). See issue #24357.
 *
 * The fix is a per-format split: the ESM build keeps them external, the CJS
 * build bundles them in. This test locks that shape so the split cannot
 * silently regress.
 */
import { describe, expect, it } from 'vitest';
import config from '../tsdown.config';

const entries = Array.isArray(config) ? config : [config];

function entryFor(format: string) {
  const entry = entries.find(e => {
    const f = e.format;
    return Array.isArray(f) ? f.includes(format as never) : f === format;
  });
  if (!entry) throw new Error(`No tsdown entry for format "${format}"`);
  return entry;
}

describe('tsdown packaging split (issue #24357)', () => {
  it('splits the build into separate esm and cjs entries', () => {
    expect(entries.length).toBe(2);
    expect(() => entryFor('esm')).not.toThrow();
    expect(() => entryFor('cjs')).not.toThrow();
  });

  it('bundles the ESM-only deps into the CJS build', () => {
    const cjs = entryFor('cjs');
    expect(cjs.deps?.alwaysBundle).toEqual(expect.arrayContaining(['ts-blank-space', 'typescript']));
    // Bundling into CJS means they must not also be marked external.
    expect(cjs.deps?.neverBundle ?? []).not.toContain('ts-blank-space');
    expect(cjs.deps?.neverBundle ?? []).not.toContain('typescript');
  });

  it('keeps the ESM-only deps external in the ESM build', () => {
    const esm = entryFor('esm');
    expect(esm.deps?.neverBundle).toEqual(expect.arrayContaining(['ts-blank-space', 'typescript']));
  });
});
