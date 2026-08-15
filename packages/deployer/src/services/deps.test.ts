import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MastraError } from '@mastra/core/error';
import { describe, expect, it, vi } from 'vitest';
import { createChildProcessLogger } from '../deploy/log';
import { copyPnpmWorkspaceSettings, DepsService, getPnpmIgnoredBuildPackages } from './deps';

vi.mock('../deploy/log', () => ({
  createChildProcessLogger: vi.fn(() => vi.fn(async () => undefined)),
}));

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
      `packages:\n  - packages/*\n\nsupportedArchitectures:\n  os: [\"linux\"]\n`,
      { os: ['darwin'], cpu: ['arm64'] },
    );

    expect(output).toBe(`packages:\n  - '.'\n\nsupportedArchitectures:\n  os: [\"darwin\"]\n  cpu: [\"arm64\"]\n`);
  });

  it('writes workspace dependency overrides for pnpm installs', () => {
    const output = copyPnpmWorkspaceSettings('', {
      pnpmOverrides: {
        '@inner/transitive-c': 'file:./workspace-module/inner-transitive-c-1.0.0.tgz',
      },
    });

    expect(output).toBe(
      `packages:\n  - '.'\n\noverrides:\n  \"@inner/transitive-c\": \"file:./workspace-module/inner-transitive-c-1.0.0.tgz\"\n`,
    );
  });

  it('writes a requested pnpm node linker for portable installs', () => {
    expect(copyPnpmWorkspaceSettings('', { pnpmNodeLinker: 'hoisted' })).toBe(
      `packages:\n  - '.'\n\nnodeLinker: hoisted\n`,
    );
  });
});

describe('DepsService explicit lock install commands', () => {
  it('does not auto-detect bun.lockb', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-deps-bun-lockb-'));
    try {
      await writeFile(join(dir, 'bun.lockb'), Buffer.from([0, 1, 2]));
      expect(new DepsService(dir).getPackageManager()).toBe('npm');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it.each([
    ['npm', 'npm ci --force --audit=false --fund=false --loglevel=error --progress=false --update-notifier=false'],
    ['pnpm', 'pnpm install --frozen-lockfile --loglevel=error'],
    ['yarn', 'yarn install --immutable'],
    ['bun', 'bun install --frozen-lockfile'],
  ] as const)('uses the frozen %s command', async (packageManager, command) => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-deps-command-'));
    try {
      const deps = new DepsService(dir);
      const installState = {
        packageManager,
        frozen: true,
        generateSecondaryNpmLockfile: false,
      } as const;

      await deps.install({ dir, installState });

      const childProcessLogger = vi.mocked(createChildProcessLogger).mock.results.at(-1)?.value;
      expect(childProcessLogger).toHaveBeenCalledWith({
        cmd: command,
        args: [],
        env: process.env,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('propagates frozen install failure without a mutable fallback', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-deps-frozen-failure-'));
    const failure = new Error('frozen install failed');
    const childProcessLogger = vi.fn().mockRejectedValue(failure);
    vi.mocked(createChildProcessLogger).mockReturnValueOnce(childProcessLogger as any);

    try {
      await expect(
        new DepsService(dir).install({
          dir,
          installState: {
            packageManager: 'pnpm',
            frozen: true,
            generateSecondaryNpmLockfile: false,
          },
        }),
      ).rejects.toThrow('frozen install failed');
      expect(childProcessLogger).toHaveBeenCalledTimes(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
