import { it, describe, expect, beforeAll, inject } from 'vitest';
import { join } from 'path';
import { setupMonorepo } from './prepare';
import { chmod, mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import getPort from 'get-port';
import { execa, execaNode } from 'execa';
import { timeout, activeProcesses } from './helpers';

describe.for([['pnpm'] as const])(`%s monorepo`, { concurrent: false }, ([pkgManager]) => {
  beforeAll(() => {
    process.env.pnpm_config_registry = inject('registry');
  });

  describe('deployer module aliases', { concurrent: false }, () => {
    it(
      'should replace aliased dependencies in every bundling pass',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-deployer-alias-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          const appDir = join(isolatedFixturePath, 'apps', 'custom');
          const mastraConfigPath = join(appDir, 'src', 'mastra', 'index.ts');
          const ajvShimPath = join(appDir, 'src', 'ajv-shim.mjs');
          const ajv2020ShimPath = join(appDir, 'src', 'ajv-2020-shim.mjs');
          const ajvFormatsShimPath = join(appDir, 'src', 'ajv-formats-shim.mjs');
          await Promise.all([
            writeFile(
              ajvShimPath,
              `globalThis.MASTRA_AJV_SHIM = true;
export class Ajv {
  compile() { const validate = () => true; validate.errors = null; return validate; }
  addFormat() { return this; }
  addKeyword() { return this; }
}
export default Ajv;
`,
            ),
            writeFile(ajv2020ShimPath, `export { Ajv as default, Ajv, Ajv as Ajv2020 } from './ajv-shim.mjs';\n`),
            writeFile(ajvFormatsShimPath, `export default function addFormats(ajv) { return ajv; }\n`),
          ]);

          const originalConfig = await readFile(mastraConfigPath, 'utf-8');
          const deployerSource = `
import { Deployer } from '@mastra/deployer';
import { aliasValidators } from '@inner/alias-source';

(globalThis as any).MASTRA_ALIAS_VALIDATORS = aliasValidators;

class AliasDeployer extends Deployer {
  protected platform = 'browser' as const;
  protected defaultExternalsPreset = true;

  constructor() { super({ name: 'alias-test' }); }

  async bundle(entryFile: string, outputDirectory: string, { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string }) {
    await this._bundle(\`
      import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';
      import { mastra } from '#mastra';
      import { createNodeServer, getToolExports } from '#server';
      import { tools } from '#tools';
      await createNodeServer(mastra, { tools: getToolExports(tools), studio: false });
      const storage = mastra.getStorage();
      if (storage) {
        if (!storage.disableInit) await storage.init();
        mastra.__registerInternalWorkflow(scoreTracesWorkflow);
      }
    \`, entryFile, {
      outputDirectory,
      projectRoot,
      alias: {
        ajv: '@inner/alias-source/replacement',
        'ajv/dist/2020.js': './src/ajv-2020-shim.mjs',
        'ajv-formats': './src/ajv-formats-shim.mjs',
      },
    }, toolsPaths);
  }

  async deploy(_outputDirectory: string) {}
}
`;
          await writeFile(
            mastraConfigPath,
            `${deployerSource}\n${originalConfig
              .replace(
                'export const mastra = new Mastra({',
                'export const mastra = new Mastra({\n  deployer: new AliasDeployer(),',
              )
              .replace(
                "externals: ['bcrypt', '@inner/subpath-only']",
                "externals: ['bcrypt', '@inner/subpath-only', '@mastra/deployer', 'ajv']",
              )}`,
          );

          const buildResult = await execa(pkgManager, ['build'], {
            cwd: appDir,
            reject: false,
            env: { ...process.env, MASTRA_BUILD_SKIP_INSTALL: 'true' },
          });
          expect(buildResult.exitCode, `${buildResult.stdout}\n${buildResult.stderr}`).toBe(0);

          const outputDir = join(appDir, '.mastra', 'output');
          const outputFiles = (await readdir(outputDir)).filter(file => file.endsWith('.mjs'));
          const output = (await Promise.all(outputFiles.map(file => readFile(join(outputDir, file), 'utf-8')))).join(
            '\n',
          );
          expect(output).toContain('MASTRA_BROWSER_CJS_ALIAS_SHIM');
          expect(output).not.toContain('MASTRA_NODE_ALIAS_SHIM');
          // #29572: the deployer is stripped from the entry
          expect(output).not.toContain('alias-test');

          const outputPackageJson = JSON.parse(await readFile(join(outputDir, 'package.json'), 'utf-8'));
          expect(outputPackageJson.dependencies ?? {}).not.toHaveProperty('ajv');
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });

  describe('bundler options with file-based agents', { concurrent: false }, () => {
    // `mastra build` reads options from a generated wrapper when file-based agents exist; the
    // wrapper has no `new Mastra({...})`, so the `bundler` block was dropped for defaults (#29048).
    it(
      'applies bundler options from index.ts when the project has file-based agents (#29048)',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-fs-agents-bundler-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          const appDir = join(isolatedFixturePath, 'apps', 'custom');
          const agentDir = join(appDir, 'src', 'mastra', 'agents', 'fs-helper');
          await mkdir(agentDir, { recursive: true });
          await Promise.all([
            writeFile(join(agentDir, 'config.ts'), `export default { model: 'openai/gpt-5-mini' };\n`),
            writeFile(join(agentDir, 'instructions.md'), 'You are a helper.\n'),
          ]);

          const mastraConfigPath = join(appDir, 'src', 'mastra', 'index.ts');
          const mastraConfig = await readFile(mastraConfigPath, 'utf-8');
          await writeFile(mastraConfigPath, mastraConfig.replace('bundler: {', 'bundler: {\n    sourcemap: true,'));

          const buildResult = await execa(pkgManager, ['build'], {
            cwd: appDir,
            reject: false,
            env: { ...process.env, MASTRA_BUILD_SKIP_INSTALL: 'true' },
          });
          expect(buildResult.exitCode, `${buildResult.stdout}\n${buildResult.stderr}`).toBe(0);

          const outputFiles = await readdir(join(appDir, '.mastra', 'output'));
          expect(outputFiles).toContain('index.mjs.map');
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );

    // The wrapper only imports index.ts, so the build stripped the deployer from the wrapper
    // and left it, with its build-time dependencies, in the server bundle (#29996).
    it(
      'strips the deployer from index.ts when the project has file-based agents (#29996)',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-fs-agents-deployer-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          const appDir = join(isolatedFixturePath, 'apps', 'custom');
          const mastraDir = join(appDir, 'src', 'mastra');
          const agentDir = join(mastraDir, 'agents', 'fs-helper');
          await mkdir(agentDir, { recursive: true });
          await mkdir(join(mastraDir, 'public'), { recursive: true });
          await Promise.all([
            writeFile(join(agentDir, 'config.ts'), `export default { model: 'openai/gpt-5-mini' };\n`),
            writeFile(join(agentDir, 'instructions.md'), 'You are a helper.\n'),
            writeFile(join(mastraDir, 'public', 'fs-agents-public.txt'), 'public\n'),
          ]);

          const mastraConfigPath = join(mastraDir, 'index.ts');
          const originalConfig = await readFile(mastraConfigPath, 'utf-8');
          const deployerSource = `
import { Deployer } from '@mastra/deployer';

class FsAgentsDeployer extends Deployer {
  constructor() { super({ name: 'fs-agents-deployer' }); }

  async bundle(entryFile: string, outputDirectory: string, { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string }) {
    await this._bundle(\`
      import { mastra } from '#mastra';
      import { createNodeServer, getToolExports } from '#server';
      import { tools } from '#tools';
      await createNodeServer(mastra, { tools: getToolExports(tools), studio: false });
    \`, entryFile, { outputDirectory, projectRoot }, toolsPaths);
  }

  async deploy(_outputDirectory: string) {}
}
`;
          await writeFile(
            mastraConfigPath,
            `${deployerSource}\n${originalConfig
              .replace(
                'export const mastra = new Mastra({',
                'export const mastra = new Mastra({\n  deployer: new FsAgentsDeployer(),',
              )
              .replace(
                "externals: ['bcrypt', '@inner/subpath-only']",
                "externals: ['bcrypt', '@inner/subpath-only', '@mastra/deployer']",
              )}`,
          );

          const buildResult = await execa(pkgManager, ['build'], {
            cwd: appDir,
            reject: false,
            env: { ...process.env, MASTRA_BUILD_SKIP_INSTALL: 'true' },
          });
          const buildOutput = `${buildResult.stdout}\n${buildResult.stderr}`;
          expect(buildResult.exitCode, buildOutput).toBe(0);
          expect(buildOutput).not.toContain('Invalid Mastra config');

          const outputDir = join(appDir, '.mastra', 'output');
          const outputFiles = await readdir(outputDir);
          const output = (
            await Promise.all(
              outputFiles.filter(file => file.endsWith('.mjs')).map(file => readFile(join(outputDir, file), 'utf-8')),
            )
          ).join('\n');
          expect(output).not.toContain('fs-agents-deployer');
          expect(outputFiles).toContain('fs-agents-public.txt');
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });

  describe('workspace subpath externals', { concurrent: false }, () => {
    it(
      'should copy the pnpm lockfile unchanged when packing workspace packages for an app outside the workspace root',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-lockfile-copy-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          // Skip only the output install, so the lockfile copy stays as the deployer wrote it.
          // pnpm rewrites it on install and drops the importers outside the output directory.
          const binDir = join(isolatedFixturePath, 'stub-bin');
          await mkdir(binDir);
          const realPackageManager = (await execa('which', [pkgManager])).stdout;
          await writeFile(
            join(binDir, pkgManager),
            `#!/bin/sh\nif [ "$1" = install ]; then exit 0; fi\nexec "${realPackageManager}" "$@"\n`,
          );
          await chmod(join(binDir, pkgManager), 0o755);

          const appDir = join(isolatedFixturePath, 'apps', 'custom');
          const buildResult = await execa(join(appDir, 'node_modules', '.bin', 'mastra'), ['build'], {
            cwd: appDir,
            reject: false,
            env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
          });
          expect(buildResult.exitCode, `${buildResult.stdout}\n${buildResult.stderr}`).toBe(0);

          const outputDir = join(appDir, '.mastra', 'output');
          expect(await readdir(join(outputDir, 'workspace-module'))).toContain('inner-subpath-only-1.0.0.tgz');
          // An edited lockfile makes pnpm 11 recheck every entry against the registry, which fails
          // without credentials for private registries (#29279).
          expect(await readFile(join(outputDir, 'pnpm-lock.yaml'), 'utf-8')).toBe(
            await readFile(join(isolatedFixturePath, 'pnpm-lock.yaml'), 'utf-8'),
          );
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );

    it(
      'should package an external workspace dependency without an optimized workspace parent',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-external-only-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          const transitivePackageDir = join(isolatedFixturePath, 'packages', 'transitive-c');
          const transitivePackageJsonPath = join(transitivePackageDir, 'package.json');
          const transitivePackageJson = JSON.parse(await readFile(transitivePackageJsonPath, 'utf-8'));
          delete transitivePackageJson.dependencies['@inner/subpath-only'];
          await writeFile(transitivePackageJsonPath, JSON.stringify(transitivePackageJson));
          await writeFile(join(transitivePackageDir, 'src', 'index.js'), "export const valueC = 'c';\n");

          const appDir = join(isolatedFixturePath, 'apps', 'custom');
          const buildResult = await execa(pkgManager, ['build'], { cwd: appDir, reject: false, env: process.env });
          expect(buildResult.exitCode, `${buildResult.stdout}\n${buildResult.stderr}`).toBe(0);

          const outputDir = join(appDir, '.mastra', 'output');
          const outputPackageJson = JSON.parse(await readFile(join(outputDir, 'package.json'), 'utf-8'));
          expect(outputPackageJson.dependencies['@inner/subpath-only']).toBe(
            'file:./workspace-module/inner-subpath-only-1.0.0.tgz',
          );
          expect(await readFile(join(outputDir, 'workspace-module', 'inner-subpath-only-1.0.0.tgz'))).toBeTruthy();

          const importResult = await execa(
            'node',
            [
              '--input-type=module',
              '-e',
              `import assert from 'node:assert/strict';
import { rootValue } from '@inner/subpath-only';
import { subpathOnlyValue } from '@inner/subpath-only/value';
assert.equal(rootValue, 'external-workspace-root-implementation-marker');
assert.equal(subpathOnlyValue, 'c');`,
            ],
            { cwd: outputDir, reject: false },
          );
          expect(importResult.exitCode, `${importResult.stdout}\n${importResult.stderr}`).toBe(0);
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );

    it(
      'should not analyze dependencies listed in bundler externals',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-analysis-external-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          const corePath = join(isolatedFixturePath, 'apps', 'custom', 'node_modules', '@mastra', 'core', 'dist');
          await mkdir(join(corePath, 'runtime-context'), { recursive: true });
          await writeFile(
            join(corePath, 'runtime-context', 'index.js'),
            `export { RequestContext as RuntimeContext } from '../request-context/index.js';`,
          );

          const appDir = join(isolatedFixturePath, 'apps', 'custom');
          const unsafePackageDir = join(appDir, 'node_modules', 'analysis-unsafe');
          await mkdir(unsafePackageDir, { recursive: true });
          await Promise.all([
            writeFile(
              join(unsafePackageDir, 'package.json'),
              JSON.stringify({ name: 'analysis-unsafe', version: '1.0.0', type: 'module', exports: './index.js' }),
            ),
            writeFile(join(unsafePackageDir, 'index.js'), 'export const broken = ;'),
          ]);

          const mastraConfigPath = join(appDir, 'src', 'mastra', 'index.ts');
          const mastraConfig = await readFile(mastraConfigPath, 'utf-8');
          await writeFile(
            mastraConfigPath,
            `import 'analysis-unsafe';\n${mastraConfig.replace(
              "externals: ['bcrypt', '@inner/subpath-only']",
              "externals: ['analysis-unsafe', 'bcrypt', '@inner/subpath-only']",
            )}`,
          );

          const buildResult = await execa(pkgManager, ['build'], {
            cwd: appDir,
            reject: false,
            env: { ...process.env, MASTRA_BUILD_SKIP_INSTALL: 'true' },
          });
          expect(buildResult.exitCode, `${buildResult.stdout}\n${buildResult.stderr}`).toBe(0);
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );

    it(
      'should build a workspace subpath imported transitively when the app imports the package root',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-subpath-test-${pkgManager}-`));
        await setupMonorepo(isolatedFixturePath, pkgManager);

        const corePath = join(isolatedFixturePath, 'apps', 'custom', 'node_modules', '@mastra', 'core', 'dist');
        await mkdir(join(corePath, 'runtime-context'), { recursive: true });
        await writeFile(
          join(corePath, 'runtime-context', 'index.js'),
          `export { RequestContext as RuntimeContext } from '../request-context/index.js';`,
        );

        const mastraConfigPath = join(isolatedFixturePath, 'apps', 'custom', 'src', 'mastra', 'index.ts');
        const originalMastraConfig = await readFile(mastraConfigPath, 'utf-8');

        const port = await getPort();
        const controller = new AbortController();
        let proc: ReturnType<typeof execaNode> | undefined;

        try {
          await writeFile(mastraConfigPath, originalMastraConfig.replace(/externals:\s*\[[^\]]*\]/, 'externals: true'));

          const buildResult = await execa(pkgManager, ['build'], {
            cwd: join(isolatedFixturePath, 'apps', 'custom'),
            reject: false,
            env: process.env,
          });
          expect(buildResult.exitCode).toBe(0);

          const bundledEntry = await readFile(
            join(isolatedFixturePath, 'apps', 'custom', '.mastra', 'output', 'index.mjs'),
            'utf-8',
          );
          expect(bundledEntry).not.toContain('@inner/subpath-only/value');

          proc = execaNode('index.mjs', {
            cwd: join(isolatedFixturePath, 'apps', 'custom', '.mastra', 'output'),
            cancelSignal: controller.signal,
            env: {
              OPENAI_API_KEY: process.env.OPENAI_API_KEY,
              MASTRA_PORT: port.toString(),
            },
          });
          activeProcesses.push({ controller, proc });

          await new Promise<void>((resolve, reject) => {
            proc!.stderr?.on('data', data => {
              const errMsg = data?.toString();
              if (errMsg && errMsg.includes('punycode')) {
                return;
              }
              if (errMsg && errMsg.includes('falling back to an in-memory store')) {
                return;
              }
              reject(new Error('failed to start subpath-only externals build: ' + errMsg));
            });
            proc!.stdout?.on('data', data => {
              console.log(data?.toString());
              if (data?.toString()?.includes(`http://localhost:${port}`)) {
                resolve();
              }
            });
          });

          const res = await fetch(`http://localhost:${port}/transitive-workspace`);
          const body = await res.json();
          expect(res.status).toBe(200);
          expect(body).toEqual({
            value: 'a -> b -> c',
            root: 'external-workspace-root-implementation-marker',
            app: 'App value is BEFORE.',
          });
        } finally {
          if (proc) {
            try {
              setImmediate(() => controller.abort());
              await proc;
            } catch (err) {
              // @ts-expect-error - isCanceled is not typed
              if (!err.isCanceled) {
                console.log('failed to kill subpath-only externals build proc', err);
              }
            }
          }

          await writeFile(mastraConfigPath, originalMastraConfig);
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );

    it(
      'should reject an unresolved subpath from an externalized workspace package',
      async () => {
        const isolatedFixturePath = await mkdtemp(join(tmpdir(), `mastra-monorepo-missing-dep-test-${pkgManager}-`));
        try {
          await setupMonorepo(isolatedFixturePath, pkgManager);

          // Test a subpath absent from the workspace package's exports map.
          const mastraConfigPath = join(isolatedFixturePath, 'apps', 'custom', 'src', 'mastra', 'index.ts');
          const mastraConfig = await readFile(mastraConfigPath, 'utf-8');
          await writeFile(
            mastraConfigPath,
            mastraConfig.replace("externals: ['bcrypt', '@inner/subpath-only']", "externals: ['bcrypt']"),
          );

          const corePath = join(isolatedFixturePath, 'apps', 'custom', 'node_modules', '@mastra', 'core', 'dist');
          await mkdir(join(corePath, 'runtime-context'), { recursive: true });
          await writeFile(
            join(corePath, 'runtime-context', 'index.js'),
            `export { RequestContext as RuntimeContext } from '../request-context/index.js';`,
          );

          const transitiveDependencyPath = join(isolatedFixturePath, 'packages', 'transitive-c', 'src', 'index.js');
          const transitiveDependencySource = await readFile(transitiveDependencyPath, 'utf-8');
          await writeFile(
            transitiveDependencyPath,
            transitiveDependencySource.replace('@inner/subpath-only/value', '@inner/subpath-only/missing'),
          );

          const buildResult = await execa(pkgManager, ['build'], {
            cwd: join(isolatedFixturePath, 'apps', 'custom'),
            reject: false,
            env: process.env,
          });
          const output = `${buildResult.stdout}\n${buildResult.stderr}`;

          expect(buildResult.exitCode, output).toBe(1);
          expect(output).toContain('Missing "./missing" specifier in "@inner/subpath-only" package');
        } finally {
          await rm(isolatedFixturePath, { recursive: true, force: true });
        }
      },
      timeout,
    );
  });
});
