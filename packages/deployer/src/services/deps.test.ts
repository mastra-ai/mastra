import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MastraError } from '@mastra/core/error';
import { beforeEach, describe, expect, it } from 'vitest';
import { copyPnpmWorkspaceSettings, DepsService, getPnpmIgnoredBuildPackages } from './deps';

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
    const base = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'mastra-deps-'));
    sourceRoot = path.join(base, 'source');
    outputDir = path.join(base, 'output');
    await fsPromises.mkdir(path.join(sourceRoot, 'patches'), { recursive: true });
    await fsPromises.mkdir(outputDir, { recursive: true });
    await fsPromises.writeFile(path.join(sourceRoot, 'pnpm-lock.yaml'), '');
  });

  async function writeWorkspace(contents: string) {
    await fsPromises.writeFile(path.join(sourceRoot, 'pnpm-workspace.yaml'), contents);
  }

  async function run() {
    const deps = new DepsService(sourceRoot);
    await (deps as unknown as { writePnpmConfig(dir: string): Promise<void> }).writePnpmConfig(outputDir);
    return fsPromises.readFile(path.join(outputDir, 'pnpm-workspace.yaml'), 'utf-8');
  }

  it('copies declared patch files into the output and rewrites their paths', async () => {
    await fsPromises.writeFile(path.join(sourceRoot, 'patches', 'foo.patch'), 'PATCH CONTENTS');
    await writeWorkspace(`packages:\n  - packages/*\n\npatchedDependencies:\n  foo@1.0.0: patches/foo.patch\n`);

    const output = await run();

    expect(output).toContain(`patchedDependencies:\n  "foo@1.0.0": "pnpm-patches/foo.patch"`);
    expect(output).toContain('allowUnusedPatches: true');
    expect(await fsPromises.readFile(path.join(outputDir, 'pnpm-patches', 'foo.patch'), 'utf-8')).toBe(
      'PATCH CONTENTS',
    );
  });

  it('keeps patches with colliding file names distinct', async () => {
    await fsPromises.mkdir(path.join(sourceRoot, 'patches', 'nested'), { recursive: true });
    await fsPromises.writeFile(path.join(sourceRoot, 'patches', 'foo.patch'), 'FIRST');
    await fsPromises.writeFile(path.join(sourceRoot, 'patches', 'nested', 'foo.patch'), 'SECOND');
    await writeWorkspace(
      `patchedDependencies:\n  foo@1.0.0: patches/foo.patch\n  bar@2.0.0: patches/nested/foo.patch\n`,
    );

    const output = await run();

    expect(output).toContain(`"foo@1.0.0": "pnpm-patches/foo.patch"`);
    expect(output).toContain(`"bar@2.0.0": "pnpm-patches/bar_2.0.0-foo.patch"`);
    expect(await fsPromises.readFile(path.join(outputDir, 'pnpm-patches', 'foo.patch'), 'utf-8')).toBe('FIRST');
    expect(await fsPromises.readFile(path.join(outputDir, 'pnpm-patches', 'bar_2.0.0-foo.patch'), 'utf-8')).toBe(
      'SECOND',
    );
  });

  it('skips declarations whose patch file is missing instead of failing the build', async () => {
    await writeWorkspace(`patchedDependencies:\n  foo@1.0.0: patches/missing.patch\n`);

    const output = await run();

    expect(output).not.toContain('patchedDependencies');
    expect(fs.existsSync(path.join(outputDir, 'pnpm-patches'))).toBe(false);
  });

  it('leaves output untouched when the source declares no patches', async () => {
    await writeWorkspace(`packages:\n  - packages/*\n\nminimumReleaseAge: 1440\n`);

    const output = await run();

    expect(output).toBe(`packages:\n  - '.'\n\nminimumReleaseAge: 1440\n`);
    expect(fs.existsSync(path.join(outputDir, 'pnpm-patches'))).toBe(false);
  });
});
