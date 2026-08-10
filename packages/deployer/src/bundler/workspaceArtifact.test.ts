import { execSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Config } from '@mastra/core/mastra';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Bundler } from './index';

const timeout = 120_000;
const tempDirs: string[] = [];

class TestBundler extends Bundler {
  async bundle(): Promise<void> {}

  getEnvFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }

  // The real install pulls the app's externals from the registry. This suite asserts on the
  // shape of the emitted artifact, so skip it.
  protected async installDependencies(): Promise<void> {}

  // What `mastra build` and the cloud deployer both resolve to.
  protected async getUserBundlerOptions(): Promise<NonNullable<Config['bundler']>> {
    return { externals: true, sourcemap: false, transpilePackages: [] };
  }

  async run(serverFile: string, mastraEntryFile: string, projectRoot: string, outputDirectory: string) {
    await this.prepare(outputDirectory);
    await this._bundle(serverFile, mastraEntryFile, { projectRoot, outputDirectory });
  }
}

type WorkspacePackage = {
  dir: string;
  manifest: Record<string, unknown>;
  files: Record<string, string>;
  /** Packages to link into this package's own node_modules. */
  links?: string[];
};

/** Lays out an npm-workspaces monorepo with a Mastra app in `apps/app`. */
async function createWorkspaceApp({ entry, packages }: { entry: string; packages: WorkspacePackage[] }) {
  // realpath because find-workspaces compares locations against process.cwd(), which is already
  // resolved (on macOS /var is a symlink to /private/var).
  const root = await realpath(await mkdtemp(join(tmpdir(), 'mastra-workspace-artifact-')));
  tempDirs.push(root);

  const appDir = join(root, 'apps', 'app');
  await mkdir(join(appDir, 'src', 'mastra'), { recursive: true });
  await mkdir(join(appDir, 'node_modules', '@repo'), { recursive: true });

  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'workspace-root', private: true, workspaces: ['apps/*', 'packages/*'] }),
  );
  await writeFile(join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3 }));
  await writeFile(
    join(appDir, 'package.json'),
    JSON.stringify({
      name: 'app',
      version: '1.0.0',
      dependencies: Object.fromEntries(packages.map(({ manifest }) => [manifest.name as string, '*'])),
    }),
  );

  const locations = new Map<string, string>();
  for (const { dir, manifest, files } of packages) {
    const location = join(root, 'packages', dir);
    locations.set(manifest.name as string, location);
    await mkdir(location, { recursive: true });
    await writeFile(join(location, 'package.json'), JSON.stringify(manifest));
    for (const [name, contents] of Object.entries(files)) {
      await writeFile(join(location, name), contents);
    }
  }

  for (const [name, location] of locations) {
    await symlink(location, join(appDir, 'node_modules', name), 'dir');
  }

  for (const { manifest, links } of packages) {
    for (const link of links ?? []) {
      const linkPath = join(locations.get(manifest.name as string)!, 'node_modules', link);
      await mkdir(dirname(linkPath), { recursive: true });
      await symlink(locations.get(link)!, linkPath, 'dir');
    }
  }

  const mastraEntryFile = join(appDir, 'src', 'mastra', 'index.ts');
  await writeFile(mastraEntryFile, entry);

  return { root, appDir, mastraEntryFile, outputDirectory: join(appDir, '.mastra') };
}

/** Builds the app and reads back the pieces of the artifact a deploy target consumes. */
async function buildArtifact(options: Parameters<typeof createWorkspaceApp>[0]) {
  const { root, appDir, mastraEntryFile, outputDirectory } = await createWorkspaceApp(options);
  // find-workspaces and the tarball packing both resolve the workspace root from cwd.
  const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(root);

  try {
    await new TestBundler('Test').run(
      `import { mastra } from '#mastra';\nconsole.log(mastra);\n`,
      mastraEntryFile,
      appDir,
      outputDirectory,
    );
  } finally {
    cwdSpy.mockRestore();
  }

  const outputDir = join(outputDirectory, 'output');
  const emitted = (await readdir(outputDir, { recursive: true })).filter(name => typeof name === 'string');
  const bundledCode = (
    await Promise.all(
      emitted.filter(name => name.endsWith('.mjs')).map(name => readFile(join(outputDir, name), 'utf-8')),
    )
  ).join('\n');

  return {
    outputDir,
    emitted,
    bundledCode,
    manifest: JSON.parse(await readFile(join(outputDir, 'package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>;
      resolutions?: Record<string, string>;
    },
  };
}

afterAll(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

describe('deploy artifact for a workspace package that is bundled', () => {
  let artifact: Awaited<ReturnType<typeof buildArtifact>>;

  beforeAll(async () => {
    artifact = await buildArtifact({
      entry: `import { greeting } from '@repo/contracts';\nexport const mastra = { greeting };\n`,
      packages: [
        {
          dir: 'contracts',
          manifest: { name: '@repo/contracts', version: '0.1.0', type: 'module', main: 'index.js' },
          files: { 'index.js': `export const greeting = 'hello from contracts';\n` },
        },
      ],
    });
  }, timeout);

  it('compiles the workspace package into the bundle', () => {
    expect(artifact.bundledCode).toContain('hello from contracts');
  });

  it('does not also declare the workspace package as a local tarball dependency', () => {
    // The code is already in the bundle, so nothing has to be installed for it at runtime.
    expect(artifact.manifest.dependencies ?? {}).not.toHaveProperty('@repo/contracts');
    expect(JSON.stringify(artifact.manifest)).not.toContain('workspace-module');
    expect(artifact.emitted).not.toContain('workspace-module');
  });

  it(
    'ships a manifest that installs without the rest of the output directory',
    async () => {
      // A deploy target may install from the manifest before the rest of the output is available,
      // so the manifest cannot reference files that live beside it.
      const manifestLayer = await mkdtemp(join(tmpdir(), 'mastra-manifest-layer-'));
      tempDirs.push(manifestLayer);
      await writeFile(
        join(manifestLayer, 'package.json'),
        await readFile(join(artifact.outputDir, 'package.json'), 'utf-8'),
      );

      expect(() =>
        execSync('npm install --force --prefer-offline --no-audit --no-fund', {
          cwd: manifestLayer,
          stdio: 'pipe',
        }),
      ).not.toThrow();
    },
    timeout,
  );
});

describe('deploy artifact for a workspace package that stays external', () => {
  let artifact: Awaited<ReturnType<typeof buildArtifact>>;

  beforeAll(async () => {
    artifact = await buildArtifact({
      entry: `import { midValue } from '@repo/mid';\nexport const mastra = { midValue };\n`,
      packages: [
        {
          dir: 'mid',
          manifest: {
            name: '@repo/mid',
            version: '0.2.0',
            type: 'module',
            main: 'index.js',
            dependencies: { '@repo/subpath-only': '*' },
          },
          files: {
            'index.js': `import { value } from '@repo/subpath-only/value';\nexport const midValue = 'mid: ' + value;\n`,
          },
          links: ['@repo/subpath-only'],
        },
        {
          // No root export, so the analyze step cannot compile it into the bundle.
          dir: 'subpath-only',
          manifest: {
            name: '@repo/subpath-only',
            version: '0.3.0',
            type: 'module',
            exports: { './value': './value.js' },
          },
          files: { 'value.js': `export const value = 'value from subpath-only';\n` },
        },
      ],
    });
  }, timeout);

  it('keeps packing the workspace package the bundle still imports', () => {
    expect(artifact.bundledCode).toContain('@repo/subpath-only/value');
    expect(artifact.manifest.dependencies).toHaveProperty(
      '@repo/subpath-only',
      'file:./workspace-module/repo-subpath-only-0.3.0.tgz',
    );
    expect(artifact.emitted).toContain(join('workspace-module', 'repo-subpath-only-0.3.0.tgz'));
  });

  it('does not pack the bundled package that depends on it', () => {
    expect(artifact.manifest.dependencies ?? {}).not.toHaveProperty('@repo/mid');
    expect(artifact.emitted).not.toContain(join('workspace-module', 'repo-mid-0.2.0.tgz'));
  });
});
