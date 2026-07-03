import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStudioPreviewCorePeerOverrides } from './validate-examples.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const studioPreviewPackageJsonPath = 'examples/studio-preview/package.json';

describe('studio preview Mastra peer validation', () => {
  it('rejects a core override below linked CLI and deployer peer ranges', () => {
    const packageJson = {
      name: 'examples-studio-preview',
      pnpm: {
        overrides: {
          '@mastra/core': '1.45.0',
          '@mastra/deployer-vercel': 'link:../../deployers/vercel',
          mastra: 'link:../../packages/cli',
        },
      },
    };
    const errors = [];

    const hasInvalidPeerOverride = validateStudioPreviewCorePeerOverrides(packageJson, studioPreviewPackageJsonPath, {
      repoRoot,
      errors,
    });

    assert.equal(hasInvalidPeerOverride, true);
    assert.match(errors.join('\n'), /@mastra\/core override 1\.45\.0/);
    assert.match(errors.join('\n'), /@mastra\/deployer-vercel/);
    assert.match(errors.join('\n'), /mastra/);
  });

  it('accepts the committed Studio preview core override', () => {
    const packageJson = JSON.parse(fs.readFileSync(resolve(repoRoot, studioPreviewPackageJsonPath), 'utf-8'));
    const errors = [];

    const hasInvalidPeerOverride = validateStudioPreviewCorePeerOverrides(packageJson, studioPreviewPackageJsonPath, {
      repoRoot,
      errors,
    });

    assert.equal(hasInvalidPeerOverride, false, errors.join('\n'));
    assert.deepEqual(errors, []);
  });
});
