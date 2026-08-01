import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Bundler } from './index';

vi.mock('../build/analyze', () => ({
  analyzeBundle: vi.fn(async () => ({
    dependencies: new Map([['googleapis', '171.4.0']]),
    externalDependencies: new Map([['googleapis', { version: '171.4.0' }]]),
    workspaceMap: new Map(),
  })),
}));

const tempDirs: string[] = [];

class LockfileTestBundler extends Bundler {
  readonly installs: unknown[][] = [];
  private readonly options: { lockfile?: string; packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun' };

  constructor(options: { lockfile?: string; packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun' } = {}) {
    super('LockfileTest');
    this.options = options;
  }

  async bundle(): Promise<void> {}

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

  getState() {
    return this.bundleDependencyInstallState;
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

    await bundler.runBundle('server-file', join(projectRoot, 'mastra.ts'), {
      projectRoot,
      outputDirectory,
    });

    expect(bundler.installs).toHaveLength(1);
    expect((bundler.installs[0]?.[3] as any).packageManager).toBe('pnpm');
    expect((bundler.installs[0]?.[3] as any).frozen).toBe(true);
    expect(await readFile(join(outputDirectory, 'output', 'pnpm-lock.yaml'), 'utf8')).toBe('lock bytes\n');
    expect(bundler.getState()).toBeUndefined();
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

  it('rejects a manager mismatch and never reaches the installer', async () => {
    const { projectRoot, outputDirectory, bundler } = await createBundleFixture({ lockfile: 'package-lock.json' });
    await writeFile(join(projectRoot, 'package-lock.json'), '{}\n');

    await expect(
      bundler.runBundle('server-file', join(projectRoot, 'mastra.ts'), { projectRoot, outputDirectory }),
    ).rejects.toThrow('does not match the pnpm bundle installer');
    expect(bundler.installs).toHaveLength(0);
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
    expect(bundler.getState()).toBeUndefined();
  });

  it('does not leak explicit state into a later automatic build', async () => {
    const { projectRoot, outputDirectory, bundler } = await createBundleFixture({ lockfile: 'pnpm-lock.yaml' });

    await bundler.runBundle('server-file', join(projectRoot, 'mastra.ts'), { projectRoot, outputDirectory });
    (bundler as any).options.lockfile = undefined;
    await bundler.runBundle('server-file', join(projectRoot, 'mastra.ts'), { projectRoot, outputDirectory });

    expect((bundler.installs[1]?.[3] as any).explicitLockfile).toBeUndefined();
    expect((bundler.installs[1]?.[3] as any).frozen).toBe(false);
    expect(bundler.getState()).toBeUndefined();
  });
});
