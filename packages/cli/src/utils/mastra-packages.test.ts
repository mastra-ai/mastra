import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPackageInfo } from 'local-pkg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getMastraPackages } from './mastra-packages.js';

vi.mock('local-pkg', () => ({ getPackageInfo: vi.fn() }));

const mockGetPackageInfo = vi.mocked(getPackageInfo);

describe('getMastraPackages', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'mastra-packages-test-'));
    mockGetPackageInfo.mockReset();
    mockGetPackageInfo.mockResolvedValue(undefined);
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  function writeManifest(manifest: Record<string, unknown>) {
    writeFileSync(join(rootDir, 'package.json'), JSON.stringify(manifest));
  }

  it('discovers scoped and bare Mastra packages declared only as optional', async () => {
    writeManifest({ optionalDependencies: { '@mastra/example': '^1.0.0', mastra: '^2.0.0' } });

    expect(await getMastraPackages(rootDir)).toEqual([
      { name: '@mastra/example', version: '^1.0.0' },
      { name: 'mastra', version: '^2.0.0' },
    ]);
  });

  it('filters unrelated optional packages before resolving versions', async () => {
    writeManifest({
      optionalDependencies: { unrelated: '^1.0.0', 'mastra-extra': '^1.0.0', '@mastra/example': '^2.0.0' },
    });

    expect(await getMastraPackages(rootDir)).toEqual([{ name: '@mastra/example', version: '^2.0.0' }]);
    expect(mockGetPackageInfo).toHaveBeenCalledExactlyOnceWith('@mastra/example');
  });

  it.each([
    { dependencies: { '@mastra/example': '^1.0.0' } },
    { devDependencies: { '@mastra/example': '^2.0.0' } },
    { dependencies: { '@mastra/example': '^1.0.0' }, devDependencies: { '@mastra/example': '^2.0.0' } },
  ])('gives optional declarations precedence over $dependencies and $devDependencies', async declarations => {
    writeManifest({ ...declarations, optionalDependencies: { '@mastra/example': '^3.0.0' } });

    expect(await getMastraPackages(rootDir)).toEqual([{ name: '@mastra/example', version: '^3.0.0' }]);
    expect(mockGetPackageInfo).toHaveBeenCalledTimes(1);
  });

  it('preserves regular and development discovery and existing overlap precedence', async () => {
    writeManifest({
      dependencies: { '@mastra/example': '^1.0.0', mastra: '^1.0.0', unrelated: '^1.0.0' },
      devDependencies: { '@mastra/example': '^2.0.0', '@mastra/dev': '^2.0.0' },
    });

    expect(await getMastraPackages(rootDir)).toEqual([
      { name: '@mastra/example', version: '^2.0.0' },
      { name: 'mastra', version: '^1.0.0' },
      { name: '@mastra/dev', version: '^2.0.0' },
    ]);
  });

  it('falls back to the optional specification when resolution throws', async () => {
    writeManifest({
      dependencies: { '@mastra/example': '^1.0.0' },
      optionalDependencies: { '@mastra/example': '^3.0.0' },
    });
    mockGetPackageInfo.mockRejectedValue(new Error('not installed'));

    expect(await getMastraPackages(rootDir)).toEqual([{ name: '@mastra/example', version: '^3.0.0' }]);
  });

  it('prefers the installed version to the optional specification', async () => {
    writeManifest({ optionalDependencies: { '@mastra/example': '^3.0.0' } });
    mockGetPackageInfo.mockResolvedValue({
      name: '@mastra/example',
      version: '3.1.0',
      rootPath: join(rootDir, 'node_modules', '@mastra', 'example'),
      packageJsonPath: join(rootDir, 'node_modules', '@mastra', 'example', 'package.json'),
      packageJson: { name: '@mastra/example', version: '3.1.0' },
    });

    expect(await getMastraPackages(rootDir)).toEqual([{ name: '@mastra/example', version: '3.1.0' }]);
  });

  it('returns an empty inventory for absent dependency sections', async () => {
    writeManifest({});
    expect(await getMastraPackages(rootDir)).toEqual([]);
    expect(mockGetPackageInfo).not.toHaveBeenCalled();
  });

  it('returns an empty inventory for a missing manifest', async () => {
    expect(await getMastraPackages(rootDir)).toEqual([]);
  });

  it('returns an empty inventory for a malformed manifest', async () => {
    writeFileSync(join(rootDir, 'package.json'), '{');
    expect(await getMastraPackages(rootDir)).toEqual([]);
  });
});
