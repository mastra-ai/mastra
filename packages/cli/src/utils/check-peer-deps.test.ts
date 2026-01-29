import { getPackageInfo } from 'local-pkg';
import { describe, expect, it, vi } from 'vitest';

import { checkMastraPeerDeps, logPeerDepWarnings } from './check-peer-deps.js';
import type { MastraPackageInfo } from './mastra-packages.js';

// Mock local-pkg
vi.mock('local-pkg', () => ({
  getPackageInfo: vi.fn(),
}));

const mockGetPackageInfo = vi.mocked(getPackageInfo);

describe('checkMastraPeerDeps', () => {
  it('should return empty array when no packages have peer deps', async () => {
    const packages: MastraPackageInfo[] = [
      { name: '@mastra/core', version: '1.0.0' },
      { name: '@mastra/memory', version: '1.0.0' },
    ];

    mockGetPackageInfo.mockResolvedValue({
      name: '@mastra/core',
      version: '1.0.0',
      rootPath: '/node_modules/@mastra/core',
      packageJson: {},
    } as ReturnType<typeof getPackageInfo>);

    const mismatches = await checkMastraPeerDeps(packages);
    expect(mismatches).toEqual([]);
  });

  it('should return mismatch when peer dep version is not satisfied', async () => {
    const packages: MastraPackageInfo[] = [
      { name: '@mastra/core', version: '0.5.0' },
      { name: '@mastra/memory', version: '1.0.0' },
    ];

    mockGetPackageInfo.mockImplementation(async (name: string) => {
      if (name === '@mastra/memory') {
        return {
          name: '@mastra/memory',
          version: '1.0.0',
          rootPath: '/node_modules/@mastra/memory',
          packageJson: {
            peerDependencies: {
              '@mastra/core': '>=1.0.0-0 <2.0.0-0',
            },
          },
        } as ReturnType<typeof getPackageInfo>;
      }
      return {
        name,
        version: packages.find(p => p.name === name)?.version ?? '0.0.0',
        rootPath: `/node_modules/${name}`,
        packageJson: {},
      } as ReturnType<typeof getPackageInfo>;
    });

    const mismatches = await checkMastraPeerDeps(packages);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toEqual({
      package: '@mastra/memory',
      peerDep: '@mastra/core',
      requiredRange: '>=1.0.0-0 <2.0.0-0',
      installedVersion: '0.5.0',
    });
  });

  it('should return empty array when peer dep version is satisfied', async () => {
    const packages: MastraPackageInfo[] = [
      { name: '@mastra/core', version: '1.0.5' },
      { name: '@mastra/memory', version: '1.0.0' },
    ];

    mockGetPackageInfo.mockImplementation(async (name: string) => {
      if (name === '@mastra/memory') {
        return {
          name: '@mastra/memory',
          version: '1.0.0',
          rootPath: '/node_modules/@mastra/memory',
          packageJson: {
            peerDependencies: {
              '@mastra/core': '>=1.0.0-0 <2.0.0-0',
            },
          },
        } as ReturnType<typeof getPackageInfo>;
      }
      return {
        name,
        version: packages.find(p => p.name === name)?.version ?? '0.0.0',
        rootPath: `/node_modules/${name}`,
        packageJson: {},
      } as ReturnType<typeof getPackageInfo>;
    });

    const mismatches = await checkMastraPeerDeps(packages);
    expect(mismatches).toHaveLength(0);
  });

  it('should ignore non-mastra peer deps', async () => {
    const packages: MastraPackageInfo[] = [{ name: '@mastra/cli', version: '1.0.0' }];

    mockGetPackageInfo.mockResolvedValue({
      name: '@mastra/cli',
      version: '1.0.0',
      rootPath: '/node_modules/@mastra/cli',
      packageJson: {
        peerDependencies: {
          zod: '^3.0.0',
        },
      },
    } as ReturnType<typeof getPackageInfo>);

    const mismatches = await checkMastraPeerDeps(packages);
    expect(mismatches).toHaveLength(0);
  });
});

describe('logPeerDepWarnings', () => {
  it('should return false when no mismatches', () => {
    const result = logPeerDepWarnings([]);
    expect(result).toBe(false);
  });

  it('should return true when mismatches exist', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = logPeerDepWarnings([
      {
        package: '@mastra/memory',
        peerDep: '@mastra/core',
        requiredRange: '>=1.0.0',
        installedVersion: '0.5.0',
      },
    ]);

    expect(result).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
