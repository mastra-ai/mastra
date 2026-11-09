import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkMastraPeerDeps } from './check-peer-deps.js';
import { getMastraPackages } from './mastra-packages.js';

function writeJson(path: string, value: Record<string, unknown>) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

function installPackage(projectDir: string, name: string, version: string, peerDependencies?: Record<string, string>) {
  writeJson(join(projectDir, 'node_modules', name, 'package.json'), { name, version, peerDependencies });
}

describe('mastra dev/build in a monorepo app', () => {
  let repoDir: string;
  let appDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    repoDir = realpathSync(mkdtempSync(join(tmpdir(), 'mastra-monorepo-')));
    appDir = join(repoDir, 'apps', 'app');

    // The repo root has a stale install that is inconsistent with itself.
    writeJson(join(repoDir, 'package.json'), { name: 'repo', private: true });
    installPackage(repoDir, '@mastra/core', '1.46.0');
    installPackage(repoDir, '@mastra/memory', '1.20.0', { '@mastra/core': '>=1.47.0-0 <1.50.0-0' });

    writeJson(join(appDir, 'package.json'), {
      name: 'app',
      dependencies: { '@mastra/core': '^1.50.0', '@mastra/memory': '^1.20.0' },
    });

    // `mastra dev` is run from the app folder.
    process.chdir(appDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(repoDir, { recursive: true, force: true });
  });

  it("reports the app's installed versions and no false peer-dependency warning", async () => {
    installPackage(appDir, '@mastra/core', '1.50.0');
    installPackage(appDir, '@mastra/memory', '1.20.0', { '@mastra/core': '>=1.50.0-0 <2.0.0-0' });

    const packages = await getMastraPackages(appDir);

    expect(packages).toEqual([
      { name: '@mastra/core', version: '1.50.0' },
      { name: '@mastra/memory', version: '1.20.0' },
    ]);
    expect(await checkMastraPeerDeps(packages, appDir)).toEqual([]);
  });

  it("still reads packages hoisted to the repo root when the app doesn't install its own", async () => {
    const packages = await getMastraPackages(appDir);

    expect(packages).toEqual([
      { name: '@mastra/core', version: '1.46.0' },
      { name: '@mastra/memory', version: '1.20.0' },
    ]);
    expect(await checkMastraPeerDeps(packages, appDir)).toEqual([
      {
        package: '@mastra/memory',
        packageVersion: '1.20.0',
        peerDep: '@mastra/core',
        requiredRange: '>=1.47.0-0 <1.50.0-0',
        installedVersion: '1.46.0',
      },
    ]);
  });
});
