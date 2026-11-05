import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { noopLogger } from '@internal/core/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DepsService } from './deps';

// The install itself is the only thing replaced: each test records the output manifest at the moment the
// package manager would read it, which is what decides the versions the deployed server gets.
const { runChildProcess } = vi.hoisted(() => ({
  runChildProcess: vi.fn(),
}));

vi.mock('../deploy/log.js', () => ({
  createChildProcessLogger: () => runChildProcess,
}));

const tempDirs: string[] = [];
let currentOutputDir = '';
let installedManifest: unknown;

beforeEach(() => {
  installedManifest = undefined;
  runChildProcess.mockReset();
  runChildProcess.mockImplementation(async ({ cmd }: { cmd: string }) => {
    installedManifest = JSON.parse(await readFile(join(currentOutputDir, 'package.json'), 'utf-8'));
    return { success: true, stdout: cmd, stderr: '' };
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

const PACKED_FOO = 'file:./workspace-module/foo-1.0.0.tgz';

/** The manifest `mastra build` writes for an app that imports `exceljs` and the packed workspace package `foo`. */
const packedOutputManifest = {
  name: 'server',
  version: '1.0.0',
  private: true,
  type: 'module',
  dependencies: { exceljs: '4.4.0', foo: PACKED_FOO },
  resolutions: { foo: PACKED_FOO },
};

/** Same app without workspace packages: the deployer writes no `resolutions` and keeps the source lockfile. */
const plainOutputManifest = {
  name: 'server',
  version: '1.0.0',
  private: true,
  type: 'module',
  dependencies: { exceljs: '4.4.0' },
};

async function createWorkspace({
  lockfile,
  rootManifest,
  outputManifest,
  appManifest = { name: 'api', version: '1.0.0' },
  workspacePackage = { name: 'foo', version: '1.0.0' },
}: {
  lockfile: string;
  rootManifest: Record<string, unknown>;
  outputManifest: Record<string, unknown>;
  appManifest?: Record<string, unknown>;
  /** The manifest of the workspace package the app depends on, which `mastra build` packs. */
  workspacePackage?: Record<string, unknown>;
}) {
  const root = await mkdtemp(join(tmpdir(), 'mastra-deps-bun-overrides-'));
  tempDirs.push(root);
  const appDir = join(root, 'apps', 'api');
  const outputDir = join(appDir, '.mastra', 'output');
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ private: true, workspaces: ['apps/*', 'packages/*'], ...rootManifest }, null, 2),
  );
  await writeFile(join(root, lockfile), lockfile === 'pnpm-lock.yaml' ? "lockfileVersion: '9.0'\n" : '{}');
  await writeFile(join(appDir, 'package.json'), JSON.stringify(appManifest));
  const workspacePackageDir = join(root, 'packages', 'foo');
  await mkdir(workspacePackageDir, { recursive: true });
  await writeFile(join(workspacePackageDir, 'package.json'), JSON.stringify(workspacePackage));
  const outputManifestSource = JSON.stringify(outputManifest, null, 2);
  await writeFile(join(outputDir, 'package.json'), outputManifestSource);
  currentOutputDir = outputDir;
  return { root, appDir, outputDir, outputManifestSource };
}

async function installBun(
  rootManifest: Record<string, unknown>,
  outputManifest: Record<string, unknown> = packedOutputManifest,
  appManifest?: Record<string, unknown>,
  workspacePackage?: Record<string, unknown>,
) {
  const workspace = await createWorkspace({
    lockfile: 'bun.lock',
    rootManifest,
    outputManifest,
    appManifest,
    workspacePackage,
  });
  const warn = vi.spyOn(noopLogger, 'warn');
  const deps = new DepsService(workspace.appDir);
  deps.__setLogger(noopLogger);
  await deps.install({ dir: workspace.outputDir });
  expect(runChildProcess).toHaveBeenCalledTimes(1);
  expect(runChildProcess.mock.calls[0]?.[0].cmd).toBe('bun install');
  return { ...workspace, warn };
}

// #29311: `mastra build` installs `.mastra/output` from a manifest it generates. For a Bun project the root
// `overrides` never reached that manifest, so the deployed server installed the vulnerable `uuid@8` that the
// project had already overridden to `uuid@11`.
describe('Bun output install keeps the project overrides (#29311)', () => {
  it('installs a Bun workspace with packed workspace packages using the root overrides', async () => {
    await installBun({ overrides: { uuid: '^11.1.1' } });

    // Bun reads `overrides` and ignores `resolutions` when both are present, so the packed tarball has
    // to be in the same field as the project's overrides or `foo` stops resolving to it.
    expect(installedManifest).toMatchObject({
      dependencies: { exceljs: '4.4.0', foo: PACKED_FOO },
      overrides: { uuid: '^11.1.1', foo: PACKED_FOO },
    });
  });

  // In the project, Bun 1.4.4 lets a bare `foo: "npm:..."` override replace the workspace package `foo`. The build
  // always packs the workspace package from source, so the output installs that instead, and the user is told.
  it('keeps the packed tarball over a project override for the same package and warns about it', async () => {
    const { warn } = await installBun({ overrides: { foo: 'npm:ms@2.1.1', uuid: '^11.1.1' } });

    expect(installedManifest).toMatchObject({ overrides: { foo: PACKED_FOO, uuid: '^11.1.1' } });
    expect(warn.mock.calls.map(([message]) => String(message))).toEqual([
      expect.stringContaining('the build output installs the packed workspace package'),
    ]);
  });

  it("keeps overrides nested under a packed package for that package's dependencies", async () => {
    const { warn } = await installBun({ overrides: { foo: { '.': '2.0.0', uuid: '^11.1.1' } } });

    // `.` is the package's own version in Bun's nested overrides, so the tarball replaces only that. Bun 1.4.4
    // installs the tarball and the overridden dependency from this shape.
    expect(installedManifest).toMatchObject({
      overrides: { foo: { '.': PACKED_FOO, uuid: '^11.1.1' } },
      resolutions: { foo: PACKED_FOO },
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"foo"'));
  });

  it('installs a Bun project without workspace packages using the root overrides', async () => {
    const { outputDir } = await installBun({ overrides: { uuid: '^11.1.1' } }, plainOutputManifest);

    expect(installedManifest).toMatchObject({ overrides: { uuid: '^11.1.1' } });
    // The source lockfile is still copied when nothing is packed.
    expect(await readFile(join(outputDir, 'bun.lock'), 'utf-8')).toBe('{}');
  });

  it('carries Yarn-style resolutions when the project declares no overrides', async () => {
    await installBun({ resolutions: { uuid: '^11.1.1', 'exceljs/archiver': '7.0.1' } });

    expect(installedManifest).toMatchObject({
      resolutions: { uuid: '^11.1.1', 'exceljs/archiver': '7.0.1', foo: PACKED_FOO },
    });
    expect(installedManifest).not.toHaveProperty('overrides');
  });

  it('carries only the overrides when the project declares both fields, as Bun does', async () => {
    await installBun({ overrides: { uuid: '^11.1.1' }, resolutions: { exceljs: '4.3.0' } });

    expect(installedManifest).toMatchObject({ overrides: { uuid: '^11.1.1', foo: PACKED_FOO } });
    expect(JSON.stringify(installedManifest)).not.toContain('4.3.0');
  });

  it('carries nothing when an empty `overrides` hides the root `resolutions`, as Bun does', async () => {
    const { outputManifestSource } = await installBun({ overrides: {}, resolutions: { uuid: '^11.1.1' } });

    expect(installedManifest).toEqual(JSON.parse(outputManifestSource));
  });

  it("points overrides nested under the app's name at the output package", async () => {
    // Bun applies `{ api: { uuid } }` to the direct dependencies of `api`. The output package is `server`.
    await installBun({ overrides: { api: { '.': '1.0.0', uuid: '^11.1.1' } } });

    expect(installedManifest).toMatchObject({ overrides: { server: { uuid: '^11.1.1' }, foo: PACKED_FOO } });
    expect(installedManifest).not.toHaveProperty('overrides.api');
  });

  it('points version-qualified app overrides at the output package when the app version matches', async () => {
    await installBun({ overrides: { 'api@1.0.0': { uuid: '^11.1.1' }, 'api@^2.0.0': { exceljs: '4.3.0' } } });

    // Bun skipped `api@^2.0.0` for api 1.0.0 in the source install, so the output skips it too.
    expect(installedManifest).toEqual(
      expect.objectContaining({ overrides: { server: { uuid: '^11.1.1' }, foo: PACKED_FOO } }),
    );
  });

  it('does not apply an override for another package named like the output package to the app', async () => {
    // In the source, `server` names some other package. In the output it would name the app's own package.
    const { warn } = await installBun({ overrides: { api: { uuid: '^11.1.1' }, server: { exceljs: '4.3.0' } } });

    expect(installedManifest).toEqual(
      expect.objectContaining({ overrides: { server: { uuid: '^11.1.1' }, foo: PACKED_FOO } }),
    );
    // The project's own `server` package loses this override in the output, so the user is told.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Not copying Bun override "server"'));
  });

  it('keeps version-qualified overrides nested under a packed package when its version matches', async () => {
    await installBun({ overrides: { 'foo@^1.0.0': { uuid: '^11.1.1' }, 'foo@^2.0.0': { exceljs: '4.3.0' } } });

    expect(installedManifest).toEqual(
      expect.objectContaining({ overrides: { foo: { uuid: '^11.1.1', '.': PACKED_FOO } } }),
    );
  });

  // Bun applies a version-qualified key over the bare key for the same package, whatever their order.
  it.each([
    ['packed package', 'foo', { foo: { uuid: '^11.1.1', '.': PACKED_FOO } }],
    ['app', 'api', { server: { uuid: '^11.1.1' } }],
  ])('lets a version-qualified %s override win over the bare one in either order', async (_, name, expected) => {
    const bare = { [name]: { uuid: '^8.3.2' } };
    const qualified = { [`${name}@1.0.0`]: { uuid: '^11.1.1' } };
    for (const overrides of [
      { ...bare, ...qualified },
      { ...qualified, ...bare },
    ]) {
      runChildProcess.mockClear();
      await installBun({ overrides });
      expect(installedManifest).toMatchObject({ overrides: expected });
    }
  });

  it('points version-qualified app overrides at the output version when the app is already named `server`', async () => {
    await installBun({ overrides: { 'server@^2.0.0': { uuid: '^11.1.1' } } }, packedOutputManifest, {
      name: 'server',
      version: '2.0.0',
    });

    // The output package is `server@1.0.0`, so the source key would no longer match it.
    expect(installedManifest).toEqual(
      expect.objectContaining({ overrides: { server: { uuid: '^11.1.1' }, foo: PACKED_FOO } }),
    );
  });

  // Checked with Bun 1.4.4: when several `name@range` keys match the same package, Bun applies each nested entry
  // from the key that sorts first by its characters, whatever their order in the manifest and however narrow
  // the range. So `foo@1.0.0` beats `foo@^1.0.0`, `foo@*` beats `foo@^1.0.0`, and `foo@^1.0.0` beats `foo@~1.0.0`.
  it.each([
    ['foo@1.0.0', 'foo@^1.0.0'],
    ['foo@*', 'foo@^1.0.0'],
    ['foo@^1.0.0', 'foo@~1.0.0'],
    ['foo@>=1.0.0', 'foo@^1.0.0'],
  ])('lets %s win over %s for a packed package in either order, as Bun does', async (winner, loser) => {
    for (const overrides of [
      { [winner]: { uuid: '^11.1.1' }, [loser]: { uuid: '^8.3.2', exceljs: '4.3.0' } },
      { [loser]: { uuid: '^8.3.2', exceljs: '4.3.0' }, [winner]: { uuid: '^11.1.1' } },
    ]) {
      runChildProcess.mockClear();
      await installBun({ overrides });
      // Entries only one key sets still apply.
      expect(installedManifest).toMatchObject({
        overrides: { foo: { uuid: '^11.1.1', exceljs: '4.3.0', '.': PACKED_FOO } },
      });
    }
  });

  it('lets the app override from the first sorting key win in either order, as Bun does', async () => {
    const winner = { 'api@1.0.0': { uuid: '^11.1.1' } };
    const loser = { 'api@^1.0.0': { uuid: '^8.3.2' } };
    for (const overrides of [
      { ...winner, ...loser },
      { ...loser, ...winner },
    ]) {
      runChildProcess.mockClear();
      await installBun({ overrides });
      expect(installedManifest).toMatchObject({ overrides: { server: { uuid: '^11.1.1' } } });
    }
  });

  it('drops version-qualified overrides for a packed package that declares no version, as Bun does', async () => {
    // The tarball gets a placeholder version, but Bun matched no `foo@range` key against the versionless
    // workspace package, not even `foo@*`.
    const placeholder = 'file:./workspace-module/foo-0.0.0.tgz';
    await installBun(
      { overrides: { 'foo@*': { uuid: '^11.1.1' }, 'foo@0.0.0': { uuid: '^11.1.1' }, exceljs: '4.4.0' } },
      { ...packedOutputManifest, dependencies: { foo: placeholder }, resolutions: { foo: placeholder } },
      undefined,
      { name: 'foo' },
    );

    expect(installedManifest).toEqual(expect.objectContaining({ overrides: { foo: placeholder, exceljs: '4.4.0' } }));
  });

  it('matches version-qualified overrides against the version of a packed package whose name ends in a version', async () => {
    const tarball = 'file:./workspace-module/foo-1.2.3-2.0.0.tgz';
    await installBun(
      { overrides: { 'foo-1.2.3@^2.0.0': { uuid: '^11.1.1' } } },
      { ...packedOutputManifest, dependencies: { 'foo-1.2.3': tarball }, resolutions: { 'foo-1.2.3': tarball } },
      undefined,
      { name: 'foo-1.2.3', version: '2.0.0' },
    );

    expect(installedManifest).toEqual(
      expect.objectContaining({ overrides: { 'foo-1.2.3': { uuid: '^11.1.1', '.': tarball } } }),
    );
  });

  it('does not replace a packed package with a version-qualified plain override, as Bun does', async () => {
    // Bun applies `foo@^1.0.0: "2.0.0"` only to registry versions of `foo`, never to the workspace package.
    const { warn } = await installBun({ overrides: { 'foo@^1.0.0': '2.0.0', uuid: '^11.1.1' } });

    expect(installedManifest).toEqual(expect.objectContaining({ overrides: { uuid: '^11.1.1', foo: PACKED_FOO } }));
    // The output matches the project here, so there is nothing to warn about.
    expect(warn).not.toHaveBeenCalled();
  });

  it("never rewrites the project's own manifest when installing in the project directory", async () => {
    const root = await mkdtemp(join(tmpdir(), 'mastra-deps-bun-overrides-root-'));
    tempDirs.push(root);
    const rootManifestSource = JSON.stringify(
      { name: 'api', dependencies: { uuid: '^11.1.1', shared: 'workspace:*' }, overrides: { uuid: '$uuid' } },
      null,
      2,
    );
    await writeFile(join(root, 'package.json'), rootManifestSource);
    await writeFile(join(root, 'bun.lock'), '{}');
    currentOutputDir = root;

    await new DepsService(root).install();

    expect(await readFile(join(root, 'package.json'), 'utf-8')).toBe(rootManifestSource);
  });

  it('resolves `catalog:` overrides from the root catalogs, as Bun does', async () => {
    await installBun({
      workspaces: {
        packages: ['apps/*', 'packages/*'],
        catalog: { exceljs: '4.4.0' },
        catalogs: { security: { uuid: '^11.1.1' } },
      },
      devDependencies: { exceljs: 'catalog:' },
      overrides: { uuid: 'catalog:security', exceljs: '$exceljs' },
    });

    expect(installedManifest).toMatchObject({ overrides: { uuid: '^11.1.1', exceljs: '4.4.0', foo: PACKED_FOO } });
  });

  it('keeps nested overrides nested', async () => {
    await installBun({ overrides: { exceljs: { uuid: '^11.1.1' } } });

    expect(installedManifest).toMatchObject({ overrides: { exceljs: { uuid: '^11.1.1' }, foo: PACKED_FOO } });
  });

  it('resolves `$name` references against the root dependencies', async () => {
    await installBun({ devDependencies: { uuid: '^11.1.1' }, overrides: { uuid: '$uuid' } });

    expect(installedManifest).toMatchObject({ overrides: { uuid: '^11.1.1', foo: PACKED_FOO } });
  });

  // Bun 1.4 resolves `$name` from optionalDependencies, then devDependencies, then dependencies, then
  // peerDependencies, whatever the key order in the manifest (checked against the overrides in bun.lock).
  it.each([
    ['devDependencies over dependencies', { dependencies: { uuid: '^8.3.2' }, devDependencies: { uuid: '^11.1.1' } }],
    [
      'optionalDependencies over devDependencies',
      { devDependencies: { uuid: '^8.3.2' }, optionalDependencies: { uuid: '^11.1.1' } },
    ],
    ['dependencies over peerDependencies', { peerDependencies: { uuid: '^8.3.2' }, dependencies: { uuid: '^11.1.1' } }],
  ])('resolves a `$name` reference declared twice the way Bun does: %s', async (_, rootDependencies) => {
    await installBun({ ...rootDependencies, overrides: { uuid: '$uuid' } });

    expect(installedManifest).toMatchObject({ overrides: { uuid: '^11.1.1', foo: PACKED_FOO } });
  });

  it('skips overrides the output directory cannot resolve and says why', async () => {
    const { warn } = await installBun({
      dependencies: { shared: 'workspace:*' },
      overrides: {
        linked: '$shared',
        uuid: '^11.1.1',
        local: 'file:../local',
        shared: 'workspace:*',
        catalogued: 'catalog:',
        missing: '$missing',
      },
    });

    expect(installedManifest).toMatchObject({ overrides: { uuid: '^11.1.1', foo: PACKED_FOO } });
    const overrides = (installedManifest as { overrides: Record<string, unknown> }).overrides;
    expect(Object.keys(overrides).sort()).toEqual(['foo', 'uuid']);
    const warnings = warn.mock.calls.map(([message]) => String(message));
    for (const name of ['linked', 'local', 'shared', 'catalogued', 'missing']) {
      expect(warnings.some(message => message.includes(`"${name}"`))).toBe(true);
    }
  });

  it('leaves the output manifest alone when the project declares no overrides', async () => {
    const { outputManifestSource } = await installBun({});

    expect(installedManifest).toEqual(JSON.parse(outputManifestSource));
  });
});

describe('npm, pnpm and Yarn output manifests are unchanged by root overrides (#29311)', () => {
  it.each(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'])(
    'does not write the root overrides into the %s project output manifest',
    async lockfile => {
      const { appDir, outputDir, outputManifestSource } = await createWorkspace({
        lockfile,
        rootManifest: { overrides: { uuid: '^11.1.1' }, resolutions: { uuid: '^11.1.1' } },
        outputManifest: packedOutputManifest,
      });

      await new DepsService(appDir).install({ dir: outputDir });

      expect(runChildProcess).toHaveBeenCalledTimes(1);
      expect(installedManifest).toEqual(JSON.parse(outputManifestSource));
    },
  );
});
