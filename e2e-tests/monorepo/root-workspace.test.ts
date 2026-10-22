import { execa } from 'execa';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { installWithRetry } from '../_local-registry-setup/install.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templateDir = join(__dirname, 'template');

const WORKSPACE_PACKAGES = `packages:
  - '.'
  - 'packages/*'

minimumReleaseAge: 0

allowBuilds:
  bcrypt: true
  esbuild: true
  bufferutil: true
  utf-8-validate: true
  sharp: true
  protobufjs: true
  workerd: true
`;

/**
 * A Mastra app can live at the workspace root. `pnpm-workspace.yaml` then has to
 * list `'.'` for the root package to be a workspace member, and workspace
 * dependencies of that root app still have to be packaged as local tarballs
 * instead of being rewritten to registry versions.
 */
describe('workspace root as the Mastra app', () => {
  let fixturePath: string | undefined;

  beforeAll(async () => {
    process.env.pnpm_config_registry = inject('registry');

    fixturePath = await mkdtemp(join(tmpdir(), 'mastra-root-workspace-test-'));

    // Reuse the monorepo packages (published workspace fixtures) but drop the
    // apps directory: the app itself is the workspace root here.
    await cp(join(templateDir, 'packages'), join(fixturePath, 'packages'), { recursive: true });
    await writeFile(
      join(fixturePath, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            esModuleInterop: true,
            skipLibCheck: true,
            strict: true,
            baseUrl: '.',
            paths: { '@/*': ['./src/mastra/*'] },
          },
        },
        null,
        2,
      ),
    );

    const packageJsonPath = join(fixturePath, 'package.json');
    await writeFile(
      packageJsonPath,
      JSON.stringify(
        {
          name: '@inner/root-app',
          version: '1.0.0',
          private: true,
          type: 'module',
          scripts: {
            dev: 'mastra dev',
            build: 'mastra build',
            start: 'mastra start',
          },
          dependencies: {
            '@mastra/core': 'monorepo-test',
            '@mastra/deployer': 'monorepo-test',
            '@inner/subpath-only': 'workspace:*',
          },
          devDependencies: {
            mastra: 'monorepo-test',
            typescript: '7.0.2',
          },
        },
        null,
        2,
      ),
    );

    await writeFile(join(fixturePath, '.npmrc'), 'minimum-release-age=0\n');
    await writeFile(join(fixturePath, 'pnpm-workspace.yaml'), WORKSPACE_PACKAGES);

    await mkdir(join(fixturePath, 'src', 'mastra'), { recursive: true });
    await writeFile(
      join(fixturePath, 'src', 'mastra', 'index.ts'),
      `import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { rootValue } from '@inner/subpath-only';

export const rootWorkspaceRoute = registerApiRoute('/root-workspace', {
  method: 'GET',
  handler: async c => c.json({ rootValue }),
});

export const mastra = new Mastra({
  server: { apiRoutes: [rootWorkspaceRoute] },
  bundler: { externals: ['@inner/subpath-only'] },
});
`,
    );

    installWithRetry('pnpm', ['install', '--config.minimum-release-age=0'], {
      cwd: fixturePath,
      env: process.env,
    });
  }, 15 * 60 * 1000);

  afterAll(async () => {
    if (fixturePath) {
      await rm(fixturePath, { recursive: true, force: true });
    }
  });

  it(
    'packages a workspace dependency of the root app as a tarball',
    async () => {
      const buildResult = await execa('pnpm', ['build'], {
        cwd: fixturePath,
        reject: false,
        env: process.env,
      });
      expect(buildResult.exitCode, `${buildResult.stdout}\n${buildResult.stderr}`).toBe(0);

      const outputDir = join(fixturePath!, '.mastra', 'output');
      const outputPackageJson = JSON.parse(await readFile(join(outputDir, 'package.json'), 'utf-8'));
      expect(outputPackageJson.dependencies['@inner/subpath-only']).toBe(
        'file:./workspace-module/inner-subpath-only-1.0.0.tgz',
      );
      expect(await readFile(join(outputDir, 'workspace-module', 'inner-subpath-only-1.0.0.tgz'))).toBeTruthy();

      const importResult = await execa('node', ['--input-type=module', '-e', "import('@inner/subpath-only')"], {
        cwd: outputDir,
        reject: false,
      });
      expect(importResult.exitCode, `${importResult.stdout}\n${importResult.stderr}`).toBe(0);
    },
    15 * 60 * 1000,
  );
});
