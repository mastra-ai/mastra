import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as legacyHarnessEntry from '../index';
import * as harnessV1Entry from './index';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const packageJson = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')) as {
  exports: Record<string, unknown>;
};

describe('Harness v1 package export acceptance', () => {
  it('maps @mastra/core/harness/v1 to v1 dist targets without replacing the legacy harness entry', () => {
    expect(packageJson.exports['./harness/v1']).toEqual({
      import: {
        types: './dist/harness/v1/index.d.ts',
        default: './dist/harness/v1/index.js',
      },
      require: {
        types: './dist/harness/v1/index.d.ts',
        default: './dist/harness/v1/index.cjs',
      },
    });
    expect(packageJson.exports['./harness']).toEqual({
      import: {
        types: './dist/harness/index.d.ts',
        default: './dist/harness/index.js',
      },
      require: {
        types: './dist/harness/index.d.ts',
        default: './dist/harness/index.cjs',
      },
    });

    expect(harnessV1Entry.Harness).toBeDefined();
    expect(harnessV1Entry.Session).toBeDefined();
    expect(harnessV1Entry.formatHarnessEventId).toBeTypeOf('function');
    expect(harnessV1Entry.Harness).not.toBe(legacyHarnessEntry.Harness);
  });
});
