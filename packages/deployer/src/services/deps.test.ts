import fs from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MastraError } from '@mastra/core/error';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyPnpmWorkspaceSettings, DepsService, getPnpmIgnoredBuildPackages } from './deps';

const { runChildProcess } = vi.hoisted(() => ({
  runChildProcess: vi.fn(),
}));

vi.mock('../deploy/log.js', () => ({
  createChildProcessLogger: () => runChildProcess,
}));

const tempDirs: string[] = [];

beforeEach(() => {
  runChildProcess.mockReset();
  runChildProcess.mockResolvedValue({ success: true, stdout: '', stderr: '' });
});

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

describe('getPnpmIgnoredBuildPackages', () => {
  it('extracts package names from pnpm ignored-build diagnostics', () => {
    expect(
      getPnpmIgnoredBuildPackages(
        '[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: utf-8-validate@6.0.5, @duckdb/node-bindings@1.3.2, fixture-native-build@file:fixture-native-build-1.0.0.tgz',
      ),
    ).toEqual(['utf-8-validate', '@duckdb/node-bindings', 'fixture-native-build']);
  });

  it('ignores unrelated package-manager output', () => {
    expect(getPnpmIgnoredBuildPackages('Process exited with code 1')).toEqual([]);
  });
});

describe('copyPnpmWorkspaceSettings', () => {
  // Source patch declarations are never copied verbatim: their paths are relative to the source
  // workspace root. They are re-emitted from options once rewritten for the output directory.
  it('copies pnpm install policy without copying source workspace packages or raw patch paths', () => {
    const output = copyPnpmWorkspaceSettings(
      `packages:\n  - packages/*\n\ncatalog:\n  react: ^19.0.0\n\nminimumReleaseAge: 1440\nminimumReleaseAgeExclude:\n  - '@mastra/*'\n\nallowBuilds:\n  onnxruntime-node: false\n  node-pty: true\n\npatchedDependencies:\n  foo@1.0.0: patches/foo.patch\n`,
    );

    expect(output).toBe(
      `packages:\n  - '.'\n\nminimumReleaseAge: 1440\n\nminimumReleaseAgeExclude:\n  - '@mastra/*'\n\nallowBuilds:\n  onnxruntime-node: false\n  node-pty: true\n`,
    );
  });

  it.each([
    `allowBuilds:\n  onnxruntime-node: false\n  node-pty: true\n\nonlyBuiltDependencies:\n  - better-sqlite3\n  - '@duckdb/node-bindings'\n`,
    `allowBuilds: { onnxruntime-node: false, node-pty: true }\n\nonlyBuiltDependencies: [better-sqlite3, '@duckdb/node-bindings']\n`,
    `allowBuilds: {}\n\nonlyBuiltDependencies: []\n`,
  ])('preserves valid explicit pnpm build approvals', source => {
    expect(copyPnpmWorkspaceSettings(source)).toBe(`packages:\n  - '.'\n\n${source}`);
  });

  it.each([
    ['allowBuilds', `allowBuilds:\n  utf-8-validate: set this to true or false\n`, 'utf-8-validate'],
    ['allowBuilds', `allowBuilds:\n  utf-8-validate: null\n`, 'utf-8-validate'],
    ['allowBuilds', `allowBuilds:\n`, 'allowBuilds'],
    ['allowBuilds', `allowBuilds: null\n`, 'allowBuilds'],
    [
      'onlyBuiltDependencies',
      `onlyBuiltDependencies:\n  - better-sqlite3\n  - name: invalid\n`,
      'onlyBuiltDependencies',
    ],
    ['onlyBuiltDependencies', `onlyBuiltDependencies: true\n`, 'onlyBuiltDependencies'],
    ['onlyBuiltDependencies', `onlyBuiltDependencies:\n`, 'onlyBuiltDependencies'],
    ['onlyBuiltDependencies', `onlyBuiltDependencies: null\n`, 'onlyBuiltDependencies'],
    ['onlyBuiltDependencies', `onlyBuiltDependencies: ['   ']\n`, 'onlyBuiltDependencies'],
    ['allowBuilds', `allowBuilds: { '': true }\n`, ''],
    ['allowBuilds', `allowBuilds: [unterminated\n`, 'allowBuilds'],
  ])('rejects malformed %s before writing headless install configuration', (key, source, invalidEntry) => {
    const error = (() => {
      try {
        copyPnpmWorkspaceSettings(source);
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(MastraError);
    expect(error).toMatchObject({
      id: 'DEPLOYER_INVALID_PNPM_BUILD_APPROVAL_CONFIG',
      details: { key },
    });
    expect((error as Error).message).toContain(invalidEntry);
  });

  it('uses requested architecture over source supportedArchitectures', () => {
    const output = copyPnpmWorkspaceSettings(
      `packages:\n  - packages/*\n\nsupportedArchitectures:\n  os: ["linux"]\n`,
      { os: ['darwin'], cpu: ['arm64'] },
    );

    expect(output).toBe(`packages:\n  - '.'\n\nsupportedArchitectures:\n  os: ["darwin"]\n  cpu: ["arm64"]\n`);
  });

  it('writes workspace dependency overrides for pnpm installs', () => {
    const output = copyPnpmWorkspaceSettings('', {
      pnpmOverrides: {
        '@inner/transitive-c': 'file:./workspace-module/inner-transitive-c-1.0.0.tgz',
      },
    });

    expect(output).toBe(
      `packages:\n  - '.'\n\noverrides:\n  "@inner/transitive-c": "file:./workspace-module/inner-transitive-c-1.0.0.tgz"\n`,
    );
  });

  it('writes a requested pnpm node linker for portable installs', () => {
    expect(copyPnpmWorkspaceSettings('', { pnpmNodeLinker: 'hoisted' })).toBe(
      `packages:\n  - '.'\n\nnodeLinker: hoisted\n`,
    );
  });

  it('writes output-relative patched dependencies and tolerates patches unused by the bundle', () => {
    const output = copyPnpmWorkspaceSettings('', {
      patchedDependencies: { '@ai-sdk/amazon-bedrock@2.0.0': 'pnpm-patches/bedrock.patch' },
    });

    expect(output).toBe(
      `packages:\n  - '.'\n\npatchedDependencies:\n  \"@ai-sdk/amazon-bedrock@2.0.0\": \"pnpm-patches/bedrock.patch\"\n\nallowUnusedPatches: true\n`,
    );
  });

  it('omits patch configuration when no patches were resolved', () => {
    expect(copyPnpmWorkspaceSettings('', { patchedDependencies: {} })).toBe(`packages:\n  - '.'\n`);
  });
});

describe('writePnpmConfig patch handling', () => {
  let sourceRoot: string;
  let outputDir: string;

  beforeEach(async () => {
    const base = await mkdtemp(join(tmpdir(), 'mastra-deps-'));
    sourceRoot = join(base, 'source');
    outputDir = join(base, 'output');
    await mkdir(join(sourceRoot, 'patches'), { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(sourceRoot, 'pnpm-lock.yaml'), '');
  });

  async function writeWorkspace(contents: string) {
    await writeFile(join(sourceRoot, 'pnpm-workspace.yaml'), contents);
  }

  async function run() {
    const deps = new DepsService(sourceRoot);
    await (deps as unknown as { writePnpmConfig(dir: string): Promise<void> }).writePnpmConfig(outputDir);
    return readFile(join(outputDir, 'pnpm-workspace.yaml'), 'utf-8');
  }

  it('copies declared patch files into the output and rewrites their paths', async () => {
    await writeFile(join(sourceRoot, 'patches', 'foo.patch'), 'PATCH CONTENTS');
    await writeWorkspace(`packages:\n  - packages/*\n\npatchedDependencies:\n  foo@1.0.0: patches/foo.patch\n`);

    const output = await run();

    expect(output).toContain(`patchedDependencies:\n  "foo@1.0.0": "pnpm-patches/foo.patch"`);
    expect(output).toContain('allowUnusedPatches: true');
    expect(await readFile(join(outputDir, 'pnpm-patches', 'foo.patch'), 'utf-8')).toBe('PATCH CONTENTS');
  });

  it('keeps patches with colliding file names distinct', async () => {
    await mkdir(join(sourceRoot, 'patches', 'nested'), { recursive: true });
    await writeFile(join(sourceRoot, 'patches', 'foo.patch'), 'FIRST');
    await writeFile(join(sourceRoot, 'patches', 'nested', 'foo.patch'), 'SECOND');
    await writeWorkspace(
      `patchedDependencies:\n  foo@1.0.0: patches/foo.patch\n  bar@2.0.0: patches/nested/foo.patch\n`,
    );

    const output = await run();

    expect(output).toContain(`"foo@1.0.0": "pnpm-patches/foo.patch"`);
    expect(output).toContain(`"bar@2.0.0": "pnpm-patches/bar_2.0.0-foo.patch"`);
    expect(await readFile(join(outputDir, 'pnpm-patches', 'foo.patch'), 'utf-8')).toBe('FIRST');
    expect(await readFile(join(outputDir, 'pnpm-patches', 'bar_2.0.0-foo.patch'), 'utf-8')).toBe('SECOND');
  });

  it('skips declarations whose patch file is missing instead of failing the build', async () => {
    await writeWorkspace(`patchedDependencies:\n  foo@1.0.0: patches/missing.patch\n`);

    const output = await run();

    expect(output).not.toContain('patchedDependencies');
    expect(fs.existsSync(join(outputDir, 'pnpm-patches'))).toBe(false);
  });

  it('skips declarations whose patch file is outside the workspace', async () => {
    const outsidePatch = join(sourceRoot, '..', 'outside.patch');
    await writeFile(outsidePatch, 'OUTSIDE');
    await writeWorkspace(`patchedDependencies:\n  foo@1.0.0: ../outside.patch\n`);

    const output = await run();

    expect(output).not.toContain('patchedDependencies');
    expect(fs.existsSync(join(outputDir, 'pnpm-patches'))).toBe(false);
  });

  it('skips an in-workspace symlink whose target resolves outside the workspace', async () => {
    const outsidePatch = join(sourceRoot, '..', 'outside.patch');
    await writeFile(outsidePatch, 'OUTSIDE');
    await symlink(outsidePatch, join(sourceRoot, 'patches', 'escape.patch'));
    await writeWorkspace(`patchedDependencies:\n  foo@1.0.0: patches/escape.patch\n`);

    const output = await run();

    expect(output).not.toContain('patchedDependencies');
    expect(fs.existsSync(join(outputDir, 'pnpm-patches'))).toBe(false);
  });

  it('leaves output untouched when the source declares no patches', async () => {
    await writeWorkspace(`packages:\n  - packages/*\n\nminimumReleaseAge: 1440\n`);

    const output = await run();

    expect(output).toBe(`packages:\n  - '.'\n\nminimumReleaseAge: 1440\n`);
    expect(fs.existsSync(join(outputDir, 'pnpm-patches'))).toBe(false);
  });
});

describe('Yarn Berry patch directory copying', () => {
  let sourceRoot: string;
  let outputDir: string;

  beforeEach(async () => {
    const base = await mkdtemp(join(tmpdir(), 'mastra-deps-yarn-patches-'));
    sourceRoot = join(base, 'source');
    outputDir = join(base, 'output');
    await mkdir(sourceRoot, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(sourceRoot, 'yarn.lock'), 'yarn lockfile v6', 'utf-8');
  });

  it('copies declared patch files into the output .yarn/patches/ directory', async () => {
    await mkdir(join(sourceRoot, '.yarn', 'patches'), { recursive: true });
    await writeFile(join(sourceRoot, '.yarn', 'patches', 'lodash.patch'), 'FIRST PATCH');
    await writeFile(join(sourceRoot, '.yarn', 'patches', 'react.patch'), 'SECOND PATCH');

    const deps = new DepsService(sourceRoot);
    await deps.install({ dir: outputDir });

    expect(await readFile(join(outputDir, '.yarn', 'patches', 'lodash.patch'), 'utf-8')).toBe('FIRST PATCH');
    expect(await readFile(join(outputDir, '.yarn', 'patches', 'react.patch'), 'utf-8')).toBe('SECOND PATCH');
  });

  it('no-ops when the source workspace has no .yarn/patches/ directory', async () => {
    const deps = new DepsService(sourceRoot);
    await deps.install({ dir: outputDir });

    expect(fs.existsSync(join(outputDir, '.yarn'))).toBe(false);
  });
});

describe('bun patchedDependencies handling', () => {
  let sourceRoot: string;
  let outputDir: string;

  beforeEach(async () => {
    const base = await mkdtemp(join(tmpdir(), 'mastra-deps-bun-patches-'));
    sourceRoot = join(base, 'source');
    outputDir = join(base, 'output');
    await mkdir(sourceRoot, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(sourceRoot, 'bun.lock'), 'bun lockfile', 'utf-8');
  });

  it('copies bun patches to output and rewrites package.json paths', async () => {
    await mkdir(join(sourceRoot, 'patches'), { recursive: true });
    await writeFile(join(sourceRoot, 'patches', 'foo.patch'), 'PATCH CONTENTS');
    await writeFile(
      join(sourceRoot, 'package.json'),
      JSON.stringify({ name: 'test-app', patchedDependencies: { 'foo@1.0.0': 'patches/foo.patch' } }),
      'utf-8',
    );
    await writeFile(join(outputDir, 'package.json'), JSON.stringify({ name: 'test-app-output' }), 'utf-8');

    const deps = new DepsService(sourceRoot);
    await deps.install({ dir: outputDir });

    expect(await readFile(join(outputDir, 'bun-patches', 'foo.patch'), 'utf-8')).toBe('PATCH CONTENTS');
    const outputPkg = JSON.parse(await readFile(join(outputDir, 'package.json'), 'utf-8'));
    expect(outputPkg).toMatchObject({ patchedDependencies: { 'foo@1.0.0': 'bun-patches/foo.patch' } });
  });

  it('no-ops when source package.json has no patchedDependencies', async () => {
    await writeFile(
      join(sourceRoot, 'package.json'),
      JSON.stringify({ name: 'test-app', dependencies: { foo: '1.0.0' } }),
      'utf-8',
    );

    const deps = new DepsService(sourceRoot);
    await deps.install({ dir: outputDir });

    expect(fs.existsSync(join(outputDir, 'bun-patches'))).toBe(false);
  });

  it('skips missing patch files instead of failing the install', async () => {
    await writeFile(
      join(sourceRoot, 'package.json'),
      JSON.stringify({ name: 'test-app', patchedDependencies: { 'foo@1.0.0': 'patches/missing.patch' } }),
      'utf-8',
    );

    const deps = new DepsService(sourceRoot);
    await deps.install({ dir: outputDir });

    expect(fs.existsSync(join(outputDir, 'bun-patches'))).toBe(false);
  });

  it('skips declarations whose patch file is outside the workspace', async () => {
    const outsidePatch = join(sourceRoot, '..', 'outside.patch');
    await writeFile(outsidePatch, 'OUTSIDE');
    await writeFile(
      join(sourceRoot, 'package.json'),
      JSON.stringify({ name: 'test-app', patchedDependencies: { 'foo@1.0.0': '../outside.patch' } }),
      'utf-8',
    );

    const deps = new DepsService(sourceRoot);
    await deps.install({ dir: outputDir });

    expect(fs.existsSync(join(outputDir, 'bun-patches'))).toBe(false);
  });

  it('no-ops when source has no package.json', async () => {
    const deps = new DepsService(sourceRoot);
    await deps.install({ dir: outputDir });

    expect(fs.existsSync(join(outputDir, 'bun-patches'))).toBe(false);
  });
});

describe('DepsService lockfile installation', () => {
  const managers = [
    {
      lockfile: 'package-lock.json',
      installCommand:
        'npm install --audit=false --fund=false --loglevel=error --progress=false --update-notifier=false',
    },
    {
      lockfile: 'pnpm-lock.yaml',
      installCommand: 'pnpm install --no-frozen-lockfile --loglevel=error',
    },
    {
      lockfile: 'yarn.lock',
      installCommand: 'yarn install --no-immutable',
    },
    {
      lockfile: 'bun.lock',
      installCommand: 'bun install',
    },
  ] as const;

  it.each(managers)(
    'copies an upward-discovered $lockfile, updates it, and installs in one operation',
    async ({ lockfile, installCommand }) => {
      const root = await mkdtemp(join(tmpdir(), 'mastra-deps-lockfile-'));
      tempDirs.push(root);
      const appDir = join(root, 'apps', 'api');
      const outputDir = join(root, 'output');
      await mkdir(appDir, { recursive: true });
      await mkdir(outputDir, { recursive: true });
      await writeFile(join(root, lockfile), `source ${lockfile}`, 'utf-8');
      await writeFile(join(outputDir, 'package.json'), '{"dependencies":{}}', 'utf-8');

      const deps = new DepsService(appDir);
      await deps.install({ dir: outputDir });

      expect(await readFile(join(outputDir, lockfile), 'utf-8')).toBe(`source ${lockfile}`);
      expect(runChildProcess).toHaveBeenCalledTimes(1);
      expect(runChildProcess).toHaveBeenCalledWith({
        cmd: installCommand,
        args: [],
        env: process.env,
      });
    },
  );

  it('updates Yarn Classic lockfiles while installing without a Berry-only flag', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mastra-deps-yarn-classic-'));
    tempDirs.push(root);
    const outputDir = join(root, 'output');
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(root, 'yarn.lock'), '# THIS IS AN AUTOGENERATED FILE.\n# yarn lockfile v1\n', 'utf-8');

    const deps = new DepsService(root);
    await deps.install({ dir: outputDir });

    expect(runChildProcess.mock.calls[0]?.[0].cmd).toBe('yarn install');
  });

  it('uses one npm install to generate a lockfile and install when no source lockfile exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mastra-deps-no-lockfile-'));
    tempDirs.push(root);
    const appDir = join(root, 'app');
    const outputDir = join(root, 'output');
    await mkdir(appDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'package.json'), '{"dependencies":{}}', 'utf-8');

    const deps = new DepsService(appDir);
    await deps.install({ dir: outputDir });

    expect(runChildProcess).toHaveBeenCalledTimes(1);
    expect(runChildProcess.mock.calls[0]?.[0]).toMatchObject({
      cmd: 'npm install --audit=false --fund=false --loglevel=error --progress=false --update-notifier=false',
      args: [],
    });
  });

  it('preserves lockfile precedence when multiple formats exist together', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mastra-deps-lockfile-precedence-'));
    tempDirs.push(root);
    const outputDir = join(root, 'output');
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(root, 'pnpm-lock.yaml'), 'pnpm source', 'utf-8');
    await writeFile(join(root, 'package-lock.json'), 'npm source', 'utf-8');

    const deps = new DepsService(root);
    await deps.install({ dir: outputDir });

    expect(await readFile(join(outputDir, 'pnpm-lock.yaml'), 'utf-8')).toBe('pnpm source');
    await expect(readFile(join(outputDir, 'package-lock.json'), 'utf-8')).rejects.toThrow();
    expect(runChildProcess.mock.calls[0]?.[0].cmd).toBe('pnpm install --no-frozen-lockfile --loglevel=error');
  });
});
