import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  it('copies pnpm install policy without copying source workspace packages', () => {
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
});

describe('DepsService lockfile preparation', () => {
  const managers = [
    {
      lockfile: 'package-lock.json',
      lockfileOnlyCommand:
        'npm install --package-lock-only --ignore-scripts --audit=false --fund=false --loglevel=error --progress=false --update-notifier=false',
      installCommand:
        'npm install --audit=false --fund=false --loglevel=error --progress=false --update-notifier=false',
    },
    {
      lockfile: 'pnpm-lock.yaml',
      lockfileOnlyCommand: 'pnpm install --lockfile-only --ignore-scripts --loglevel=error',
      installCommand: 'pnpm install --loglevel=error',
    },
    {
      lockfile: 'yarn.lock',
      lockfileOnlyCommand: 'yarn install --mode=update-lockfile',
      installCommand: 'yarn install',
    },
    {
      lockfile: 'bun.lock',
      lockfileOnlyCommand: 'bun install --lockfile-only --ignore-scripts',
      installCommand: 'bun install',
    },
  ] as const;

  it.each(managers)(
    'copies an upward-discovered $lockfile and reconciles it before installing',
    async ({ lockfile, lockfileOnlyCommand, installCommand }) => {
      const root = await mkdtemp(join(tmpdir(), 'mastra-deps-lockfile-'));
      tempDirs.push(root);
      const appDir = join(root, 'apps', 'api');
      const outputDir = join(root, 'output');
      await mkdir(appDir, { recursive: true });
      await mkdir(outputDir, { recursive: true });
      await writeFile(join(root, lockfile), `source ${lockfile}`, 'utf-8');
      await writeFile(join(outputDir, 'package.json'), '{"dependencies":{}}', 'utf-8');

      const deps = new DepsService(appDir);
      await deps.prepareLockfile({ dir: outputDir });
      await deps.install({ dir: outputDir });

      expect(await readFile(join(outputDir, lockfile), 'utf-8')).toBe(`source ${lockfile}`);
      expect(runChildProcess.mock.calls.map(([options]) => options.cmd)).toEqual([lockfileOnlyCommand, installCommand]);
      expect(runChildProcess.mock.calls.map(([options]) => options.args)).toEqual([[], []]);
    },
  );

  it('uses npm lockfile generation when no source lockfile exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mastra-deps-no-lockfile-'));
    tempDirs.push(root);
    const appDir = join(root, 'app');
    const outputDir = join(root, 'output');
    await mkdir(appDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'package.json'), '{"dependencies":{}}', 'utf-8');

    const deps = new DepsService(appDir);
    await deps.prepareLockfile({ dir: outputDir });

    expect(runChildProcess).toHaveBeenCalledTimes(1);
    expect(runChildProcess.mock.calls[0]?.[0]).toMatchObject({
      cmd: 'npm install --package-lock-only --ignore-scripts --audit=false --fund=false --loglevel=error --progress=false --update-notifier=false',
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
    await deps.prepareLockfile({ dir: outputDir });

    expect(await readFile(join(outputDir, 'pnpm-lock.yaml'), 'utf-8')).toBe('pnpm source');
    await expect(readFile(join(outputDir, 'package-lock.json'), 'utf-8')).rejects.toThrow();
    expect(runChildProcess.mock.calls[0]?.[0].cmd).toBe(
      'pnpm install --lockfile-only --ignore-scripts --loglevel=error',
    );
  });
});
