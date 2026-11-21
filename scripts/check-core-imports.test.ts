import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { substituteExportWildcard } from './check-core-imports.ts';

describe('substituteExportWildcard', () => {
  it('fills the one star in a package export target', () => {
    expectEqual(substituteExportWildcard('./dist/*/index.d.ts', 'tools'), './dist/tools/index.d.ts');
  });

  it('fills only the first star, matching a single string replace', () => {
    expectEqual(substituteExportWildcard('./dist/*/extra/*/index.d.ts', 'tools'), './dist/tools/extra/*/index.d.ts');
  });

  it('returns a target that has no star unchanged', () => {
    expectEqual(substituteExportWildcard('./dist/index.d.ts', 'tools'), './dist/index.d.ts');
    expectEqual(substituteExportWildcard(undefined, 'tools'), undefined);
  });
});

function expectEqual(actual: string | undefined, expected: string | undefined) {
  assert.equal(actual, expected);
}
