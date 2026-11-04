import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { expect, inject, it } from 'vitest';

/**
 * Workspace discovery in the deployer reads the root manifest itself (pnpm-workspace.yaml,
 * lerna.json or package.json `workspaces`) and globs for packages. The pnpm suite covers
 * pnpm-workspace.yaml and the Bun suite covers a package.json `workspaces` array; this
 * covers npm workspaces, where the dependency is declared by version rather than the
 * `workspace:` protocol and npm symlinks it from the root node_modules.
 */
it(
  'builds an npm workspace app with a packed workspace dependency',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'mastra-npm-workspace-'));
    const app = join(root, 'apps', 'server');
    const workspacePackage = join(root, 'packages', 'foo');
    const registry = inject('registry');
    const tag = inject('tag');
    const env = { ...process.env, npm_config_registry: registry };

    try {
      await mkdir(join(app, 'src', 'mastra'), { recursive: true });
      await mkdir(workspacePackage, { recursive: true });
      await writeFile(
        join(root, 'package.json'),
        JSON.stringify({ name: 'npm-workspace-root', private: true, workspaces: ['apps/*', 'packages/*'] }),
      );
      await writeFile(join(root, '.npmrc'), `registry=${registry}\n`);
      await writeFile(
        join(app, 'package.json'),
        JSON.stringify({
          name: 'npm-workspace-app',
          version: '1.0.0',
          private: true,
          type: 'module',
          scripts: { build: 'mastra build' },
          dependencies: { '@mastra/core': tag, foo: '1.0.0' },
          devDependencies: { mastra: tag },
        }),
      );
      await writeFile(
        join(app, 'src', 'mastra', 'index.ts'),
        `import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { value } from 'foo';

export const mastra = new Mastra({
  server: { apiRoutes: [registerApiRoute('/foo', { method: 'GET', handler: async c => c.json({ value }) })] },
  bundler: { externals: ['foo'] },
});
`,
      );
      await writeFile(
        join(workspacePackage, 'package.json'),
        JSON.stringify({ name: 'foo', version: '1.0.0', type: 'module', exports: './index.js' }),
      );
      await writeFile(join(workspacePackage, 'index.js'), 'export const value = 42;\n');

      await execa('npm', ['install', '--no-audit', '--no-fund'], { cwd: root, env });
      // npm links workspace packages from the root node_modules.
      expect(await readFile(join(root, 'node_modules', 'foo', 'package.json'), 'utf-8')).toContain('"name":"foo"');

      await execa('npm', ['run', 'build'], { cwd: app, env });

      const output = join(app, '.mastra', 'output');
      const outputPackage = JSON.parse(await readFile(join(output, 'package.json'), 'utf-8'));
      expect(outputPackage.dependencies.foo).toBe('file:./workspace-module/foo-1.0.0.tgz');
      expect(await readFile(join(output, 'node_modules', 'foo', 'index.js'), 'utf-8')).toContain('value = 42');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  10 * 60 * 1000,
);
