import { it, describe, expect, beforeAll, inject } from 'vitest';
import { join } from 'path';
import { setupMonorepo } from './prepare';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { execa, execaNode } from 'execa';
import { timeout, findInDir, getDirectoryDigests, removeOutputDir } from './helpers';

describe.sequential.for([['pnpm'] as const])(`%s monorepo`, ([pkgManager]) => {
  beforeAll(() => {
    process.env.pnpm_config_registry = inject('registry');
  });

  describe.sequential('pnpm build approvals', () => {
    it(
      'reports blocked native build scripts as a user configuration error',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-build-approval-test-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);
          const workspacePath = join(isolatedFixturePath, 'pnpm-workspace.yaml');
          const workspace = await readFile(workspacePath, 'utf8');
          await writeFile(workspacePath, workspace.replace('  bcrypt: true\n', ''));

          await removeOutputDir(isolatedFixturePath);
          const build = await execa(pkgManager, ['build'], {
            cwd: join(isolatedFixturePath, 'apps', 'custom'),
            env: process.env,
            reject: false,
          });
          const output = `${build.stdout}\n${build.stderr}`;

          expect(build.exitCode).not.toBe(0);
          expect(output).toContain('pnpm blocked build scripts for: bcrypt');
          expect(output).toContain('Add these packages to allowBuilds in pnpm-workspace.yaml and retry the build.');
          expect(output).not.toContain('DEPLOYER_BUNDLER_BUNDLE_STAGE_FAILED');
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });

  describe.sequential('reproducible bundles', () => {
    it(
      'produces identical bundles when invoked from the app and monorepo roots',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-reproducible-test-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          const appDir = join(isolatedFixturePath, 'apps', 'custom');
          const outputRoot = join(appDir, '.mastra', 'output');
          const build = async (cwd: string, args: string[], cliPath?: string) => {
            await rm(join(appDir, '.mastra'), { recursive: true, force: true });
            const options = {
              cwd,
              env: { ...process.env, MASTRA_BUILD_SKIP_INSTALL: 'true' },
              reject: false,
            };
            const result = cliPath ? await execaNode(cliPath, args, options) : await execa(pkgManager, args, options);
            expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
            const outputDigests = await getDirectoryDigests(outputRoot);
            return Object.fromEntries(Object.entries(outputDigests).filter(([path]) => path.endsWith('.mjs')));
          };

          const first = await build(appDir, ['build']);
          const second = await build(
            isolatedFixturePath,
            ['build', '--root', 'apps/custom'],
            join(appDir, 'node_modules', 'mastra', 'dist', 'index.js'),
          );

          expect(
            Object.keys(first).filter(path => path.startsWith('tools/') && path.endsWith('.mjs')).length,
          ).toBeGreaterThan(0);
          expect(second).toEqual(first);
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });

  describe.sequential('MASTRA_BUILD_SKIP_INSTALL', () => {
    it(
      'skips dependency installation in the build output when the env var is set',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-skip-install-test-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          const appDir = join(isolatedFixturePath, 'apps', 'custom');
          const outputRoot = join(appDir, '.mastra', 'output');

          await removeOutputDir(isolatedFixturePath);
          await expect(readFile(join(appDir, '.npmrc'), 'utf-8')).rejects.toMatchObject({ code: 'ENOENT' });
          const skipBuild = await execa(pkgManager, ['build'], {
            cwd: appDir,
            env: { ...process.env, MASTRA_BUILD_SKIP_INSTALL: 'true' },
            reject: false,
          });
          const skipOutput = `${skipBuild.stdout}\n${skipBuild.stderr}`;

          expect(skipBuild.exitCode).toBe(0);
          expect(skipOutput).toContain('Skipping dependency installation (MASTRA_BUILD_SKIP_INSTALL set)');
          await expect(readFile(join(outputRoot, '.npmrc'), 'utf-8')).rejects.toMatchObject({ code: 'ENOENT' });
          // No dependencies installed and no lockfile generated anywhere in the build output.
          expect(await findInDir(outputRoot, 'node_modules')).toBe(false);
          expect(await findInDir(outputRoot, 'package-lock.json')).toBe(false);

          await removeOutputDir(isolatedFixturePath);
          const defaultBuild = await execa(pkgManager, ['build'], {
            cwd: appDir,
            env: process.env,
            reject: false,
          });

          expect(defaultBuild.exitCode).toBe(0);
          // Default path installs dependencies into the build output.
          expect(await findInDir(outputRoot, 'node_modules')).toBe(true);
        } finally {
          await removeOutputDir(isolatedFixturePath);
        }
      },
      timeout,
    );
  });

  describe.sequential('pnpm patched dependencies', () => {
    it(
      'keeps source workspace patches applied in the built output',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-patch-test-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          // Adding a file is version-independent, so the patch stays valid as the package moves.
          await mkdir(join(isolatedFixturePath, 'patches'), { recursive: true });
          await writeFile(
            join(isolatedFixturePath, 'patches', 'unicorn-magic.patch'),
            [
              'diff --git a/mastra-patch-marker.txt b/mastra-patch-marker.txt',
              'new file mode 100644',
              '--- /dev/null',
              '+++ b/mastra-patch-marker.txt',
              '@@ -0,0 +1 @@',
              '+patched-by-mastra-e2e',
              '',
            ].join('\n'),
          );

          const workspacePath = join(isolatedFixturePath, 'pnpm-workspace.yaml');
          const workspace = await readFile(workspacePath, 'utf8');
          await writeFile(
            workspacePath,
            `${workspace}\npatchedDependencies:\n  unicorn-magic@0.4.0: patches/unicorn-magic.patch\n`,
          );
          // The new patch entry changes the lockfile config, which CI's default frozen install rejects.
          await execa(pkgManager, ['install', '--no-frozen-lockfile', '--config.minimum-release-age=0'], {
            cwd: isolatedFixturePath,
            env: process.env,
          });

          await removeOutputDir(isolatedFixturePath);
          await execa(pkgManager, ['build'], {
            cwd: join(isolatedFixturePath, 'apps', 'custom'),
            env: process.env,
          });

          const outputDir = join(isolatedFixturePath, 'apps', 'custom', '.mastra', 'output');
          const outputWorkspace = await readFile(join(outputDir, 'pnpm-workspace.yaml'), 'utf8');

          expect(outputWorkspace).toContain('"unicorn-magic@0.4.0": "pnpm-patches/unicorn-magic.patch"');
          expect(outputWorkspace).toContain('allowUnusedPatches: true');
          expect(await readFile(join(outputDir, 'pnpm-patches', 'unicorn-magic.patch'), 'utf8')).toContain(
            'patched-by-mastra-e2e',
          );
          expect(
            await readFile(join(outputDir, 'node_modules', 'unicorn-magic', 'mastra-patch-marker.txt'), 'utf8'),
          ).toContain('patched-by-mastra-e2e');
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });

  describe.sequential('patches applied in node_modules', () => {
    it(
      'applies patches to node_modules during install from the workspace config',
      async () => {
        const fixturePath = await mkdtemp(join(tmpdir(), 'mastra-monorepo-patch-install-'));
        try {
          await setupMonorepo(fixturePath, pkgManager);

          // Add unicorn-magic as a dependency of the custom app (version matches
          // the transitive dep already resolved by setupMonorepo's pnpm install)
          const appPkgPath = join(fixturePath, 'apps', 'custom', 'package.json');
          const appPkg = JSON.parse(await readFile(appPkgPath, 'utf8'));
          appPkg.dependencies = { ...appPkg.dependencies, 'unicorn-magic': '0.2.0' };
          await writeFile(appPkgPath, JSON.stringify(appPkg, null, 2));

          // Create patch file at the monorepo root
          await mkdir(join(fixturePath, 'patches'), { recursive: true });
          await writeFile(
            join(fixturePath, 'patches', 'unicorn-magic.patch'),
            [
              'diff --git a/mastra-patch-marker.txt b/mastra-patch-marker.txt',
              'new file mode 100644',
              '--- /dev/null',
              '+++ b/mastra-patch-marker.txt',
              '@@ -0,0 +1 @@',
              '+patched-by-mastra-e2e',
              '',
            ].join('\n'),
          );

          // After setupMonorepo, setupMonorepo's pnpm install already resolved
          // unicorn-magic as a transitive dependency at 0.2.0. Use 0.2.0 in
          // both the explicit app dep and the patch specifier so they match.
          const workspacePath = join(fixturePath, 'pnpm-workspace.yaml');
          const workspace = await readFile(workspacePath, 'utf8');
          await writeFile(
            workspacePath,
            `${workspace}\npatchedDependencies:\n  unicorn-magic@0.2.0: patches/unicorn-magic.patch\n`,
          );

          // Install with patches — the patched file should appear in node_modules
          await execa(pkgManager, ['install', '--no-frozen-lockfile', '--config.minimum-release-age=0'], {
            cwd: fixturePath,
            env: process.env,
          });

          expect(
            await readFile(join(fixturePath, 'node_modules', 'unicorn-magic', 'mastra-patch-marker.txt'), 'utf8'),
          ).toContain('patched-by-mastra-e2e');
        } finally {
          await rm(fixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });
});
