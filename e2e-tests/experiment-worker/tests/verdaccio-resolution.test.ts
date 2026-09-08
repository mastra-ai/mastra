import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { resolveVerdaccioPathFrom } from '../../_local-registry-setup/registry.js';

describe('Verdaccio binary resolution', () => {
  test('resolves the package binary without importing an unexported subpath', () => {
    const requireFromExperimentSuite = createRequire(resolve(import.meta.dirname, '../package.json'));
    const verdaccioPath = resolveVerdaccioPathFrom(requireFromExperimentSuite);

    expect(basename(verdaccioPath)).toBe('verdaccio');
    expect(existsSync(verdaccioPath)).toBe(true);
  });
});
