import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateExamples, validateStudioPreviewCorePeerOverrides } from './validate-examples.js';

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
    assert.match(errors.join('\n'), /override 1\.45\.0 in .* must satisfy mastra peer range/);
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

describe('examples package validation', () => {
  it('preserves missing override failures when a skipped ai-sdk-v5 example is validated later', async t => {
    const cwd = createFixtureRepo(t);
    writeExamplePackage(cwd, 'a-missing-override', {
      name: 'a-missing-override',
      dependencies: {
        '@mastra/core': 'latest',
      },
    });
    writeExamplePackage(cwd, 'z-mastra-ai-sdk-v5-use-chat-example', {
      name: 'z-mastra-ai-sdk-v5-use-chat-example',
      dependencies: {
        '@mastra/core': 'latest',
      },
    });

    const result = await validateExamples({ cwd, log: () => {} });

    assert.equal(result.hasMissingOverrides, true);
    assert.match(result.errors.join('\n'), /@mastra\/core in examples\/a-missing-override\/package\.json/);
  });

  it('handles an unnamed example package without crashing', async t => {
    const cwd = createFixtureRepo(t);
    writeExamplePackage(cwd, 'unnamed-example', {
      dependencies: {},
    });

    const result = await validateExamples({ cwd, log: () => {} });

    assert.equal(result.hasMissingOverrides, false);
  });
});

function createFixtureRepo(t) {
  const cwd = fs.mkdtempSync(join(tmpdir(), 'validate-examples-'));
  t.after(() => fs.rmSync(cwd, { force: true, recursive: true }));
  return cwd;
}

function writeExamplePackage(cwd, name, packageJson) {
  const packageRoot = join(cwd, 'examples', name);
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.writeFileSync(join(packageRoot, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  fs.writeFileSync(join(packageRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
}
