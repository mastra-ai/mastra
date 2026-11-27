import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';
import { expect, inject, it } from 'vitest';

it(
  'builds a Bun workspace app with a packed workspace dependency and the root overrides',
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'mastra-bun-workspace-'));
    const app = join(root, 'apps', 'server');
    const workspacePackage = join(root, 'packages', 'foo');
    const registry = inject('registry');
    const tag = inject('tag');

    try {
      await mkdir(join(app, 'src', 'mastra'), { recursive: true });
      await mkdir(workspacePackage, { recursive: true });
      await writeFile(
        join(root, 'package.json'),
        JSON.stringify({ private: true, workspaces: ['apps/*', 'packages/*'], overrides: { ms: '2.1.2' } }),
      );
      await writeFile(join(root, '.npmrc'), `registry=${registry}\n`);
      await writeFile(
        join(app, 'package.json'),
        JSON.stringify({
          name: 'bun-workspace-app',
          version: '1.0.0',
          private: true,
          type: 'module',
          scripts: { build: 'mastra build' },
          dependencies: { '@mastra/core': tag, debug: '4.4.3', foo: 'workspace:*' },
          devDependencies: { mastra: tag },
        }),
      );
      await writeFile(
        join(app, 'src', 'mastra', 'index.ts'),
        `import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import debug from 'debug';
import { value } from 'foo';

const log = debug('bun-workspace-app');

export const mastra = new Mastra({
  server: {
    apiRoutes: [
      registerApiRoute('/foo', {
        method: 'GET',
        handler: async c => {
          log('foo');
          return c.json({ value });
        },
      }),
    ],
  },
  bundler: { externals: ['foo', 'debug'] },
});
`,
      );
      await writeFile(
        join(workspacePackage, 'package.json'),
        JSON.stringify({ name: 'foo', version: '1.0.0', type: 'module', exports: './index.js' }),
      );
      await writeFile(join(workspacePackage, 'index.js'), 'export const value = 42;\n');

      await execa('bun', ['install'], { cwd: root, env: { ...process.env, npm_config_registry: registry } });
      expect(await readFile(join(root, 'bun.lock'), 'utf-8')).toContain('foo@workspace:packages/foo');

      await execa('bun', ['run', 'build'], { cwd: app, env: { ...process.env, npm_config_registry: registry } });

      const output = join(app, '.mastra', 'output');
      const outputPackage = JSON.parse(await readFile(join(output, 'package.json'), 'utf-8'));
      expect(outputPackage.dependencies.foo).toBe('file:./workspace-module/foo-1.0.0.tgz');
      expect(outputPackage.overrides).toEqual({ ms: '2.1.2', foo: 'file:./workspace-module/foo-1.0.0.tgz' });
      // debug@4.4.3 depends on ms ^2.1.3, so ms is 2.1.2 only when the root override reached the output install.
      expect(JSON.parse(await readFile(join(output, 'node_modules', 'ms', 'package.json'), 'utf-8')).version).toBe(
        '2.1.2',
      );
      expect(await readFile(join(output, 'node_modules', 'foo', 'index.js'), 'utf-8')).toContain('value = 42');
      expect(await readFile(join(output, 'bun.lock'), 'utf-8')).not.toContain('foo@workspace:packages/foo');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  10 * 60 * 1000,
);
