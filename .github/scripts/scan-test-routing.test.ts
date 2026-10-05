import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import routing from './scan-test-routing.cjs';

const { parseScannedRoots, selectScanTests, testsScanningChangedFiles } = routing;

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const colorRules = 'packages/playground-ui/src/color-rules.test.ts';

describe('scan test routing', () => {
  const declarations = [
    { test: 'a.test.ts', roots: ['packages/ui/src'] },
    { test: 'b.test.ts', roots: ['packages/ui/package.json'] },
  ];

  test('selects a test when a changed file sits under one of its roots', () => {
    expect(testsScanningChangedFiles(['packages/ui/src/theme/status.css'], declarations)).toEqual(['a.test.ts']);
  });

  test('selects a test whose root is a single file only on that exact file', () => {
    expect(testsScanningChangedFiles(['packages/ui/package.json'], declarations)).toEqual(['b.test.ts']);
    expect(testsScanningChangedFiles(['packages/ui/package.json.bak'], declarations)).toEqual([]);
  });

  test('does not treat a sibling folder sharing the prefix as under the root', () => {
    expect(testsScanningChangedFiles(['packages/ui/src-legacy/index.ts'], declarations)).toEqual([]);
  });

  test('reads roots from a multi-line declaration', () => {
    const source = `export const scannedRoots = [\n  'packages/a/src',\n  "packages/b/src",\n];\n`;
    expect(parseScannedRoots('x.test.ts', source)).toEqual(['packages/a/src', 'packages/b/src']);
  });

  test('rejects a declaration with no literal paths', () => {
    expect(() => parseScannedRoots('x.test.ts', 'export const scannedRoots = [root];')).toThrow(/x\.test\.ts/);
  });

  test('selects color rules for a Factory UI change the import graph cannot see', () => {
    const changed = ['mastracode/factory-ui/src/ui/domains/factory/components/BoardIcons.tsx'];
    expect(selectScanTests(changed, repoRoot)).toContain(colorRules);
  });

  test('selects color rules for a stylesheet-only change', () => {
    const changed = ['packages/playground-ui/src/ds/components/Activity/activity.css'];
    expect(selectScanTests(changed, repoRoot)).toContain(colorRules);
  });
});
