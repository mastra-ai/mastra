import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { getTestFiles } from './vitest.config.js';

describe('Vitest suite selection', () => {
  test('selects PR and full files through config instead of CLI filters', async () => {
    expect(getTestFiles('pr')).toHaveLength(6);
    expect(getTestFiles('full')).toHaveLength(11);
    expect(getTestFiles('full')).toEqual(expect.arrayContaining(getTestFiles('pr')));

    const packageJson = JSON.parse(await readFile(resolve(import.meta.dirname, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    for (const scriptName of ['test', 'test:experiment', 'test:full', 'test:full:strict']) {
      expect(packageJson.scripts[scriptName]).not.toContain('.test.ts');
    }
  });
});
