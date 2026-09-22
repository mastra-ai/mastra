import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, parse } from 'node:path';

import { getPackageInfo } from 'local-pkg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkMastraPeerDeps, detectPackageManager, getUpdateCommand, logPeerDepWarnings } from './check-peer-deps.js';
import type { MastraPackageInfo } from './mastra-packages.js';

vi.mock('node:fs', async importOriginal => ({
  ...(await importOriginal<typeof fs>()),
}));

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
      packageVersion: '1.0.0',
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

  it('should skip non-semver peer ranges like workspace:^ (monorepo-resolved packages)', async () => {
    const packages: MastraPackageInfo[] = [
      { name: '@mastra/client-js', version: '1.0.0' },
      { name: '@mastra/playground-ui', version: '1.0.0' },
    ];

    mockGetPackageInfo.mockImplementation(async (name: string) => {
      if (name === '@mastra/playground-ui') {
        return {
          name: '@mastra/playground-ui',
          version: '1.0.0',
          rootPath: '/workspace/packages/playground-ui',
          packageJson: {
            peerDependencies: {
              '@mastra/client-js': 'workspace:^',
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

  it('should ignore workspace: protocol peer dep ranges from linked packages', async () => {
    const packages: MastraPackageInfo[] = [
      { name: '@mastra/core', version: '1.0.0' },
      { name: '@mastra/playground-ui', version: '1.0.0' },
    ];

    mockGetPackageInfo.mockImplementation(async (name: string) => {
      if (name === '@mastra/playground-ui') {
        return {
          name: '@mastra/playground-ui',
          version: '1.0.0',
          rootPath: '/node_modules/@mastra/playground-ui',
          packageJson: {
            peerDependencies: {
              '@mastra/core': 'workspace:^',
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

  it.each(['workspace:^', 'catalog:', '^1.0.0'])(
    'should skip unresolved installed version %s',
    async installedVersion => {
      const packages: MastraPackageInfo[] = [
        { name: '@mastra/core', version: installedVersion },
        { name: '@mastra/memory', version: '1.0.0' },
      ];

      mockGetPackageInfo.mockImplementation(async (name: string) => {
        return {
          name,
          version: packages.find(pkg => pkg.name === name)?.version ?? '0.0.0',
          rootPath: `/node_modules/${name}`,
          packageJson: name === '@mastra/memory' ? { peerDependencies: { '@mastra/core': '^1.0.0' } } : {},
        } as ReturnType<typeof getPackageInfo>;
      });

      await expect(checkMastraPeerDeps(packages)).resolves.toEqual([]);
    },
  );
});

describe('workspace package manager detection', () => {
  let workspace: string;
  let app: string;

  beforeEach(() => {
    workspace = fs.mkdtempSync(join(tmpdir(), 'mastra-peer-deps-'));
    app = join(workspace, 'apps', 'api');
    fs.mkdirSync(app, { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
  ])('detects %s locally and in an ancestor', (lockfile, manager) => {
    fs.writeFileSync(join(workspace, lockfile), '');
    expect(detectPackageManager(workspace)).toBe(manager);
    expect(detectPackageManager(app)).toBe(manager);
  });

  it.each([
    ['pnpm-lock.yaml', 'yarn.lock', 'yarn'],
    ['yarn.lock', 'pnpm-lock.yaml', 'pnpm'],
    ['pnpm-lock.yaml', 'package-lock.json', 'npm'],
    ['yarn.lock', 'package-lock.json', 'npm'],
    ['pnpm-lock.yaml', 'npm-shrinkwrap.json', 'npm'],
    ['yarn.lock', 'npm-shrinkwrap.json', 'npm'],
  ])('prefers nearer %s / %s ownership', (outerLock, innerLock, manager) => {
    fs.writeFileSync(join(workspace, outerLock), '');
    fs.writeFileSync(join(dirname(app), innerLock), '');
    expect(detectPackageManager(app)).toBe(manager);
  });

  it('preserves same-directory pnpm, Yarn, npm priority', () => {
    for (const lockfile of ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json']) {
      fs.writeFileSync(join(workspace, lockfile), '');
    }
    expect(detectPackageManager(app)).toBe('pnpm');
    fs.unlinkSync(join(workspace, 'pnpm-lock.yaml'));
    expect(detectPackageManager(app)).toBe('yarn');
    fs.unlinkSync(join(workspace, 'yarn.lock'));
    expect(detectPackageManager(app)).toBe('npm');
  });

  it('resolves relative starting directories', () => {
    fs.writeFileSync(join(workspace, 'yarn.lock'), '');
    vi.spyOn(process, 'cwd').mockReturnValue(workspace);
    expect(detectPackageManager(join('apps', 'api'))).toBe('yarn');
  });

  it.each(['pnpm-lock.yaml', undefined])('checks the filesystem root and terminates (%s)', lockfile => {
    const root = parse(workspace).root;
    const exists = vi.spyOn(fs, 'existsSync').mockImplementation(path => path === join(root, lockfile ?? 'absent'));
    expect(detectPackageManager(join(root, 'virtual', 'app'))).toBe(lockfile ? 'pnpm' : 'npm');
    expect(exists).toHaveBeenCalledWith(join(root, 'pnpm-lock.yaml'));
    expect(exists.mock.calls.length).toBeLessThanOrEqual(12);
    if (!lockfile) expect(exists).toHaveBeenCalledWith(join(root, 'npm-shrinkwrap.json'));
  });

  const mismatch = {
    package: '@mastra/memory',
    packageVersion: '1.0.0',
    peerDep: '@mastra/core',
    requiredRange: '^1.0.0',
    installedVersion: '0.5.0',
  };

  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
  ])('prints repair guidance for a nested %s workspace', (lockfile, manager) => {
    fs.writeFileSync(join(workspace, lockfile), '');
    vi.spyOn(process, 'cwd').mockReturnValue(app);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const command = `${manager} add @mastra/core@latest`;
    expect(getUpdateCommand([mismatch])).toBe(command);
    expect(logPeerDepWarnings([mismatch])).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(command));
  });

  it.each(['package-lock.json', 'npm-shrinkwrap.json'])('uses npm guidance for a nearer %s', lockfile => {
    fs.writeFileSync(join(workspace, 'pnpm-lock.yaml'), '');
    fs.writeFileSync(join(dirname(app), lockfile), '');
    vi.spyOn(process, 'cwd').mockReturnValue(app);
    expect(getUpdateCommand([mismatch])).toBe('npm add @mastra/core@latest');
  });

  it('preserves above-range selection and deduplicates updates', () => {
    fs.writeFileSync(join(workspace, 'pnpm-lock.yaml'), '');
    vi.spyOn(process, 'cwd').mockReturnValue(app);
    const aboveRange = { ...mismatch, installedVersion: '2.0.0' };
    expect(getUpdateCommand([aboveRange, aboveRange, mismatch, mismatch])).toBe(
      'pnpm add @mastra/memory@latest @mastra/core@latest',
    );
  });

  it.each(['workspace:^', 'catalog:', '^1.0.0'])(
    'does not generate a command or warning for unresolved installed version %s',
    installedVersion => {
      const exists = vi.spyOn(fs, 'existsSync');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const unresolved = [{ ...mismatch, installedVersion }];

      expect(getUpdateCommand(unresolved)).toBeNull();
      expect(logPeerDepWarnings(unresolved)).toBe(false);
      expect(warn).not.toHaveBeenCalled();
      expect(exists).not.toHaveBeenCalled();
    },
  );

  it('ignores unresolved versions while generating commands for comparable mismatches', () => {
    fs.writeFileSync(join(workspace, 'pnpm-lock.yaml'), '');
    vi.spyOn(process, 'cwd').mockReturnValue(app);

    expect(getUpdateCommand([{ ...mismatch, installedVersion: 'workspace:^' }, mismatch])).toBe(
      'pnpm add @mastra/core@latest',
    );
  });

  it('does not emit warnings or inspect lockfiles for empty mismatches', () => {
    const exists = vi.spyOn(fs, 'existsSync');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getUpdateCommand([])).toBeNull();
    expect(logPeerDepWarnings([])).toBe(false);
    expect(exists).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
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
        packageVersion: '1.0.0',
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
