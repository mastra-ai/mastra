import { execFileSync } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Rollup, ViteDevServer } from 'vite';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sharedSrc = resolve(repoRoot, 'packages/playground-ui/src');

// Exercise each app's own Vite version, plugins, stylesheet and dev aliases.
// No library rebuild runs: saving shared source must regenerate its CSS directly.
describe.each([
  { name: 'Studio', packagePath: 'packages/playground', configPath: 'vite.config.ts', stylesheet: '/src/index.css' },
  {
    name: 'Factory',
    packagePath: 'mastracode/factory-ui',
    configPath: 'src/vite.config.ts',
    stylesheet: '/tailwind.css',
  },
])('$name hot reload', ({ packagePath, configPath, stylesheet }) => {
  describe('when starting the app through Turbo', () => {
    it('starts both shared dependency watchers', () => {
      const output = execFileSync(
        resolve(repoRoot, 'node_modules/.bin/turbo'),
        ['run', 'dev', '--filter', `./${packagePath}`, '--dry=json'],
        { cwd: repoRoot, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
      );
      const tasks: Record<string, unknown>[] = JSON.parse(output).tasks;
      for (const name of ['@mastra/playground-ui', '@mastra/react']) {
        // Initial full builds must finish before a watcher writes to the same dist.
        expect(tasks.find(task => task.taskId === `${name}#dev`)).toMatchObject({
          dependencies: expect.arrayContaining([`${name}#build`]),
        });
      }
    });
  });
  describe('when a shared component gains a utility class', () => {
    it('serves the new CSS and notifies the browser without rebuilding the library', async () => {
      const appRoot = resolve(repoRoot, packagePath);
      const require = createRequire(resolve(appRoot, 'package.json'));
      const { createServer, loadConfigFromFile } = await import(require.resolve('vite'));
      const configFile = resolve(appRoot, configPath);
      const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, configFile);
      const source = resolve(sharedSrc, `hmr-fixture-${randomUUID()}.tsx`);
      const zIndex = randomInt(100000, 1000000);
      let server: ViteDevServer | undefined;
      let socket: WebSocket | undefined;
      const messages: string[] = [];

      await writeFile(source, 'export const className = "flex";\n');
      try {
        const devServer: ViteDevServer = await createServer({
          root: loaded?.config.root ?? appRoot,
          configFile,
          logLevel: 'silent',
          server: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
          // This regression concerns CSS; avoid crawling the full app's dependencies.
          optimizeDeps: { noDiscovery: true, include: [] },
        });
        server = devServer;
        await devServer.listen();
        const address = devServer.httpServer?.address();
        if (!address || typeof address === 'string') throw new Error('Vite did not bind a TCP port');
        const origin = `http://127.0.0.1:${address.port}`;
        const hmrSocket = new WebSocket(`ws://127.0.0.1:${address.port}`, 'vite-hmr');
        socket = hmrSocket;
        hmrSocket.addEventListener('message', event => messages.push(String(event.data)));
        await new Promise<void>((resolve, reject) => {
          hmrSocket.addEventListener('open', () => resolve(), { once: true });
          hmrSocket.addEventListener('error', () => reject(new Error('HMR socket failed')), { once: true });
        });

        const initial = await fetch(`${origin}${stylesheet}`);
        expect(initial.status).toBe(200);
        expect(await initial.text()).not.toContain(`z-index: ${zIndex}`);
        messages.length = 0;

        await writeFile(source, `export const className = "z-[${zIndex}]";\n`);
        await expect
          .poll(() => messages.some(message => /"type":"(?:update|full-reload)"/.test(message)), { timeout: 5000 })
          .toBe(true);
        const updated = await fetch(`${origin}${stylesheet}`);
        expect(updated.status).toBe(200);
        expect(await updated.text()).toContain(`z-index: ${zIndex}`);
      } finally {
        socket?.close();
        await server?.close();
        await rm(source, { force: true });
      }
    }, 15000);
  });

  describe('when building for production', () => {
    it('generates utilities from compiled components rather than workspace source', async () => {
      const appRoot = resolve(repoRoot, packagePath);
      const require = createRequire(resolve(appRoot, 'package.json'));
      const { build, loadConfigFromFile } = await import(require.resolve('vite'));
      const configFile = resolve(appRoot, configPath);
      const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, configFile);
      const entry = resolve(appRoot, `hmr-entry-${randomUUID()}.mjs`);
      const source = resolve(sharedSrc, `hmr-fixture-${randomUUID()}.tsx`);
      const compiled = resolve(sharedSrc, '../dist', `hmr-fixture-${randomUUID()}.js`);
      const sourceZIndex = randomInt(100000, 1000000);
      const compiledZIndex = sourceZIndex + 1000000;

      try {
        await writeFile(source, `export const className = "z-[${sourceZIndex}]";\n`);
        await writeFile(compiled, `export const className = "z-[${compiledZIndex}]";\n`);
        await writeFile(
          entry,
          `import ${JSON.stringify(resolve(loaded?.config.root ?? appRoot, `.${stylesheet}`))};\n`,
        );
        const result: Rollup.RollupOutput = await build({
          root: loaded?.config.root ?? appRoot,
          configFile,
          logLevel: 'silent',
          build: {
            write: false,
            minify: false,
            cssMinify: false,
            rollupOptions: { input: entry },
          },
        });
        const css = result.output
          .filter((asset): asset is Rollup.OutputAsset => asset.type === 'asset' && asset.fileName.endsWith('.css'))
          .map(asset => asset.source)
          .join('\n');
        expect(css).toContain(`z-index: ${compiledZIndex}`);
        expect(css).not.toContain(`z-index: ${sourceZIndex}`);
      } finally {
        await Promise.all([source, compiled, entry].map(file => rm(file, { force: true })));
      }
    }, 15000);
  });
});
