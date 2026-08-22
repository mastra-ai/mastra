import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DepsService } from '../services';
import { Bundler } from './index';

vi.mock('../build/analyze', async () => {
  const { readFileSync } = await import('node:fs');
  const issueReproduction = JSON.parse(
    readFileSync(new URL('./fixtures/issue-20357/package.json', import.meta.url), 'utf8'),
  ) as { dependencies: Record<string, string> };

  return {
    analyzeBundle: vi.fn(async () => ({
      dependencies: new Map(Object.entries(issueReproduction.dependencies)),
      externalDependencies: new Map(
        Object.entries(issueReproduction.dependencies).map(([name, version]) => [name, { version }]),
      ),
      workspaceMap: new Map(),
    })),
  };
});

const tempDirs: string[] = [];

class LockfileTestBundler extends Bundler {
  readonly installs: unknown[][] = [];
  private readonly options: { lockfile?: string; packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun' };

  constructor(options: { lockfile?: string; packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun' } = {}) {
    super('LockfileTest');
    this.options = options;
  }

  async bundle(
    serverFile: string,
    mastraEntryFile: string,
    options: { projectRoot: string; outputDirectory: string },
  ): Promise<void> {
    await this.runBundle(serverFile, mastraEntryFile, options);
  }

  getEnvFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }

  protected async getUserBundlerOptions(): Promise<any> {
    return { externals: [], ...this.options };
  }

  protected getBundleDependencyPackageManager(): 'npm' | 'yarn' | 'pnpm' | 'bun' {
    return this.options.packageManager ?? 'pnpm';
  }

  protected async getBundlerOptions(): Promise<any> {
    return { input: {}, plugins: [] };
  }

  protected createBundler(): any {
    return { write: vi.fn(async () => undefined) };
  }

  runBundle(serverFile: string, mastraEntryFile: string, options: { projectRoot: string; outputDirectory: string }) {
    return this._bundle(serverFile, mastraEntryFile, options);
  }

  resolveState(projectRoot: string, lockfile: string | undefined, hasPackedWorkspaceDependencies: boolean) {
    return this.resolveBundleDependencyInstallState({ projectRoot, lockfile, hasPackedWorkspaceDependencies });
  }

  protected async installDependencies(...args: unknown[]): Promise<void> {
    this.installs.push(args);
    const outputDirectory = args[0] as string;
    const state = args[3] as { explicitLockfile?: { basename: string } } | undefined;
    if (state?.explicitLockfile) {
      const copied = await readFile(join(outputDirectory, this.outputDir, state.explicitLockfile.basename), 'utf8');
      expect(copied).toBe('lock bytes\n');
    }
  }
}

class BaseManagerBundler extends LockfileTestBundler {
  protected getBundleDependencyPackageManager(rootDir: string, explicitManager?: 'npm' | 'yarn' | 'pnpm' | 'bun') {
    return Bundler.prototype.getBundleDependencyPackageManager.call(this, rootDir, explicitManager);
  }
}

async function createSymlink(target: string, path: string, type: 'file' | 'junction'): Promise<boolean> {
  try {
    await symlink(target, path, type);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error.code === 'EACCES' || error.code === 'EPERM')) {
      return false;
    }
    throw error;
  }
}

async function createBundleFixture(options: { lockfile?: string } = {}) {
  const projectRoot = join(tmpdir(), `mastra-lockfile-project-${Date.now()}-${Math.random()}`);
  await mkdir(projectRoot, { recursive: true });
  const outputDirectory = join(projectRoot, 'build');
  await mkdir(join(outputDirectory, 'output'), { recursive: true });
  await writeFile(join(projectRoot, 'pnpm-lock.yaml'), 'lock bytes\n');
  tempDirs.push(projectRoot);
  return { projectRoot, outputDirectory, bundler: new LockfileTestBundler(options) };
}

describe('Bundler bundle lockfile authority', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  it('copies exact lock bytes before the installer and skips secondary npm', async () => {
    const { projectRoot, outputDirectory, bundler } = await createBundleFixture({ lockfile: 'pnpm-lock.yaml' });

    await bundler.bundle('server-file', join(projectRoot, 'mastra.ts'), {
      projectRoot,
      outputDirectory,
    });

    expect(bundler.installs).toHaveLength(1);
    expect((bundler.installs[0]?.[3] as any).packageManager).toBe('pnpm');
    expect((bundler.installs[0]?.[3] as any).frozen).toBe(true);
    expect(await readFile(join(outputDirectory, 'output', 'pnpm-lock.yaml'), 'utf8')).toBe('lock bytes\n');
  });

  it.each(['npm', 'pnpm', 'yarn', 'bun'] as const)(
    'preserves automatic %s manager selection without a lock',
    packageManager => {
      const bundler = new LockfileTestBundler({ packageManager });
      const state = bundler.resolveState(tmpdir(), undefined, false);

      expect(state.packageManager).toBe(packageManager);
      expect(state.frozen).toBe(false);
      expect(state.generateSecondaryNpmLockfile).toBe(packageManager === 'npm');
    },
  );

  it('gates the secondary npm lock on normal npm installs without packed workspaces', () => {
    const bundler = new LockfileTestBundler({ packageManager: 'npm' });

    expect(bundler.resolveState(tmpdir(), undefined, false).generateSecondaryNpmLockfile).toBe(true);
    expect(bundler.resolveState(tmpdir(), undefined, true).generateSecondaryNpmLockfile).toBe(false);
  });

  it('pins the explicit npm lock from a pnpm source without throwing and without secondary npm', async () => {
    const { projectRoot, outputDirectory } = await createBundleFixture({ lockfile: 'package-lock.json' });
    await writeFile(join(projectRoot, 'package-lock.json'), 'lock bytes\n');

    const bundler = new BaseManagerBundler({ lockfile: 'package-lock.json' });
    await bundler.runBundle('server-file', join(projectRoot, 'mastra.ts'), { projectRoot, outputDirectory });

    expect(bundler.installs).toHaveLength(1);
    expect((bundler.installs[0]?.[3] as any).packageManager).toBe('npm');
    expect((bundler.installs[0]?.[3] as any).frozen).toBe(true);
    expect((bundler.installs[0]?.[3] as any).explicitLockfile.basename).toBe('package-lock.json');
    expect(await readFile(join(outputDirectory, 'output', 'package-lock.json'), 'utf8')).toBe('lock bytes\n');
    expect((bundler.installs[0]?.[3] as any).generateSecondaryNpmLockfile).toBe(false);
  });

  it.each(['relative traversal', 'absolute outside path'] as const)(
    'rejects an explicit lockfile with an %s before installation',
    async pathKind => {
      const { projectRoot } = await createBundleFixture();
      const outsideRoot = join(tmpdir(), `mastra-lockfile-outside-${Date.now()}-${Math.random()}`);
      const outsideLockfile = join(outsideRoot, 'package-lock.json');
      await mkdir(outsideRoot, { recursive: true });
      await writeFile(outsideLockfile, 'secret bytes\n');
      tempDirs.push(outsideRoot);

      const lockfile = pathKind === 'relative traversal' ? relative(projectRoot, outsideLockfile) : outsideLockfile;
      const bundler = new BaseManagerBundler({ lockfile });

      await expect(
        bundler.runBundle('server-file', join(projectRoot, 'mastra.ts'), {
          projectRoot,
          outputDirectory: join(projectRoot, 'build'),
        }),
      ).rejects.toThrow('Bundle lockfile must stay within project root');
      expect(bundler.installs).toHaveLength(0);
    },
  );

  it('accepts an absolute lockfile inside the project and stores its canonical path', async () => {
    const { projectRoot } = await createBundleFixture();
    const lockfile = join(projectRoot, 'package-lock.json');
    await writeFile(lockfile, 'lock bytes\n');

    const state = new BaseManagerBundler().resolveState(projectRoot, lockfile, false);

    expect(state.explicitLockfile?.sourcePath).toBe(realpathSync(lockfile));
  });

  it('accepts an in-project lockfile symlink and stores its canonical path', async () => {
    const { projectRoot } = await createBundleFixture();
    const target = join(projectRoot, 'locks', 'package-lock.json');
    const link = join(projectRoot, 'package-lock.json');
    await mkdir(join(projectRoot, 'locks'), { recursive: true });
    await writeFile(target, 'lock bytes\n');
    if (!(await createSymlink(target, link, 'file'))) return;

    const state = new BaseManagerBundler().resolveState(projectRoot, link, false);

    expect(state.explicitLockfile?.sourcePath).toBe(realpathSync(target));
  });

  it('rejects a supported lockfile symlink that targets outside the project', async () => {
    const { projectRoot } = await createBundleFixture();
    const outsideRoot = join(tmpdir(), `mastra-lockfile-symlink-file-${Date.now()}-${Math.random()}`);
    const outsideLockfile = join(outsideRoot, 'package-lock.json');
    const linkedLockfile = join(projectRoot, 'package-lock.json');
    await mkdir(outsideRoot, { recursive: true });
    await writeFile(outsideLockfile, 'secret bytes\n');
    tempDirs.push(outsideRoot);
    if (!(await createSymlink(outsideLockfile, linkedLockfile, 'file'))) return;

    const bundler = new BaseManagerBundler({ lockfile: 'package-lock.json' });
    await expect(
      bundler.runBundle('server-file', join(projectRoot, 'mastra.ts'), {
        projectRoot,
        outputDirectory: join(projectRoot, 'build'),
      }),
    ).rejects.toThrow('Bundle lockfile must stay within project root');
    expect(bundler.installs).toHaveLength(0);
  });

  it('rejects a lockfile below a symlinked directory that targets outside the project', async () => {
    const { projectRoot } = await createBundleFixture();
    const outsideRoot = join(tmpdir(), `mastra-lockfile-symlink-dir-${Date.now()}-${Math.random()}`);
    const linkedDirectory = join(projectRoot, 'linked-locks');
    await mkdir(outsideRoot, { recursive: true });
    await writeFile(join(outsideRoot, 'package-lock.json'), 'secret bytes\n');
    tempDirs.push(outsideRoot);
    if (!(await createSymlink(outsideRoot, linkedDirectory, 'junction'))) return;

    const bundler = new BaseManagerBundler({ lockfile: 'linked-locks/package-lock.json' });
    await expect(
      bundler.runBundle('server-file', join(projectRoot, 'mastra.ts'), {
        projectRoot,
        outputDirectory: join(projectRoot, 'build'),
      }),
    ).rejects.toThrow('Bundle lockfile must stay within project root');
    expect(bundler.installs).toHaveLength(0);
  });

  it('uses an explicit manager when the project has no source lock', async () => {
    const projectRoot = join(tmpdir(), `mastra-lockfile-no-source-${Date.now()}-${Math.random()}`);
    await mkdir(projectRoot, { recursive: true });
    tempDirs.push(projectRoot);
    await writeFile(join(projectRoot, 'pnpm-lock.yaml'), 'lock bytes\n');

    class NoSourceBundler extends LockfileTestBundler {
      protected getBundleDependencyPackageManager(rootDir: string, explicitManager?: 'npm' | 'yarn' | 'pnpm' | 'bun') {
        return super.getBundleDependencyPackageManager(rootDir, explicitManager);
      }
    }

    const state = new NoSourceBundler().resolveState(projectRoot, 'pnpm-lock.yaml', false);
    expect(state.packageManager).toBe('pnpm');
    expect(state.frozen).toBe(true);
  });

  it('forwards the install state through the base installer seam', async () => {
    const { projectRoot, outputDirectory, bundler } = await createBundleFixture();
    const installState = {
      packageManager: 'pnpm' as const,
      frozen: true,
      generateSecondaryNpmLockfile: false,
    };
    const install = vi.spyOn(DepsService.prototype, 'install').mockResolvedValue(undefined);

    try {
      await (Bundler.prototype as any).installDependencies.call(
        bundler,
        outputDirectory,
        projectRoot,
        {},
        installState,
      );
      expect(install).toHaveBeenCalledWith({
        dir: join(outputDirectory, 'output'),
        pnpmOverrides: {},
        installState,
      });
    } finally {
      install.mockRestore();
    }
  });

  it('rejects missing, directory, unsupported, and bun.lockb inputs', async () => {
    const cases = [
      ['pnpm-lock.yaml', 'does not exist'],
      ['package-lock.json', 'must be a file'],
      ['unsupported.lock', 'Unsupported bundle lockfile'],
      ['bun.lockb', 'Unsupported bundle lockfile'],
    ] as const;

    for (const [lockfile, message] of cases) {
      const { projectRoot, outputDirectory, bundler } = await createBundleFixture({ lockfile });
      if (lockfile === 'package-lock.json') await mkdir(join(projectRoot, lockfile));
      if (message === 'does not exist') await rm(join(projectRoot, lockfile), { force: true });

      await expect(
        bundler.runBundle('server-file', join(projectRoot, 'mastra.ts'), { projectRoot, outputDirectory }),
      ).rejects.toThrow(message);
      expect(bundler.installs).toHaveLength(0);
    }
  });

  it('keeps the original three installer arguments for an old subclass', async () => {
    const { projectRoot, outputDirectory } = await createBundleFixture();
    const calls: unknown[][] = [];
    class OldBundler extends LockfileTestBundler {
      protected async installDependencies(...args: unknown[]): Promise<void> {
        calls.push(args.slice(0, 3));
      }
    }
    const bundler = new OldBundler();

    await bundler.runBundle('server-file', join(projectRoot, 'mastra.ts'), { projectRoot, outputDirectory });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.length).toBe(3);
    expect(calls[0]?.[2]).toEqual({});
  });

  it('does not leak explicit state into a later automatic build', async () => {
    const { projectRoot, outputDirectory, bundler } = await createBundleFixture({ lockfile: 'pnpm-lock.yaml' });

    await bundler.runBundle('server-file', join(projectRoot, 'mastra.ts'), { projectRoot, outputDirectory });
    (bundler as any).options.lockfile = undefined;
    await bundler.runBundle('server-file', join(projectRoot, 'mastra.ts'), { projectRoot, outputDirectory });

    expect((bundler.installs[1]?.[3] as any).explicitLockfile).toBeUndefined();
    expect((bundler.installs[1]?.[3] as any).frozen).toBe(false);
  });

  it('clears state when the frozen installer fails without a fallback', async () => {
    const { projectRoot, outputDirectory } = await createBundleFixture({ lockfile: 'pnpm-lock.yaml' });
    class FailingBundler extends LockfileTestBundler {
      protected async installDependencies(): Promise<void> {
        throw new Error('frozen install failed');
      }
    }

    const bundler = new FailingBundler({ lockfile: 'pnpm-lock.yaml' });
    await expect(
      bundler.runBundle('server-file', join(projectRoot, 'mastra.ts'), { projectRoot, outputDirectory }),
    ).rejects.toThrow('frozen install failed');
  });
});
