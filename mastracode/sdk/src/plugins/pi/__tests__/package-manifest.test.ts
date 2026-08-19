import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { inspectPiPackageManifest } from '../package-manifest.js';

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

function writeManifest(value: unknown): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-pi-manifest-'));
  tempDir = root;
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(value));
  return root;
}

describe('inspectPiPackageManifest', () => {
  it('statically reads resources, API range, dependencies, and lifecycle scripts', () => {
    const root = writeManifest({
      name: 'pi-fixture',
      version: '1.2.3',
      pi: { extensions: ['./extensions'], skills: ['./skills/**', '!./skills/private/**'] },
      peerDependencies: { '@earendil-works/pi-ai': '^0.84.1' },
      dependencies: { dep: '1.0.0' },
      scripts: { postinstall: 'node postinstall.js', test: 'vitest' },
    });

    expect(inspectPiPackageManifest(root)).toMatchObject({
      name: 'pi-fixture',
      version: '1.2.3',
      packageRoot: fs.realpathSync(root),
      resourcePatterns: {
        extensions: ['./extensions'],
        skills: ['./skills/**', '!./skills/private/**'],
      },
      observedApiVersion: '^0.84.1',
      lifecycleScripts: { postinstall: 'node postinstall.js' },
      hasDependencies: true,
    });
  });

  it('rejects malformed manifests without executing package code', () => {
    const root = writeManifest({ name: 'bad', pi: { extensions: '../escape.ts' }, scripts: { install: 12 } });

    expect(() => inspectPiPackageManifest(root)).toThrow('pi.extensions must be an array');
  });
});
