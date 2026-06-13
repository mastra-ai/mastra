import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe('schema-compat package metadata', () => {
  it('publishes @types/json-schema for consumers', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8')
    ) as PackageJson;

    expect(packageJson.dependencies?.['@types/json-schema']).toBe('^7.0.15');
    expect(packageJson.devDependencies?.['@types/json-schema']).toBeUndefined();
  });
});
