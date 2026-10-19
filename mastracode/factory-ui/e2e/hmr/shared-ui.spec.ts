import { execFileSync } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { Rollup, ViteDevServer } from 'vite';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const library = resolve(repo, 'packages/playground-ui');

test.describe('Shared UI hot reload', () => {
  for (const app of [
    { name: 'Studio', package: 'packages/playground', config: 'vite.config.ts', css: './src/index.css' },
    { name: 'Factory', package: 'mastracode/factory-ui', config: 'src/vite.config.ts', css: './tailwind.css' },
  ]) {
    test.describe(`when editing a shared component in ${app.name}`, () => {
      test('updates the component and its utilities while retaining browser and component state', async ({ page }) => {
        const id = `hmr-${randomUUID()}`;
        const componentDir = resolve(library, 'src/ds/components', id);
        const proxy = resolve(library, 'src/utils', `${id}.tsx`);
        const appPackage = resolve(repo, app.package);
        const appRequire = createRequire(resolve(appPackage, 'package.json'));
        const libraryRequire = createRequire(resolve(library, 'package.json'));
        const libraryVite = await import(libraryRequire.resolve('vite'));
        const appVite = await import(appRequire.resolve('vite'));
        const cwd = process.cwd();
        const nodeEnv = process.env.NODE_ENV;
        let watcher: Rollup.RollupWatcher | undefined;
        let server: ViteDevServer | undefined;
        let appFiles: string[] = [];
        let builds = 0;
        let buildError: Rollup.RollupError | undefined;
        const fullReloads: string[] = [];
        const browserErrors: string[] = [];
        const firstWidth = randomInt(1000, 2000);
        const component = (revision: number) => `
          import { useState } from 'react';
          export function Probe() {
            const [count, setCount] = useState(0);
            return <button className="w-[${firstWidth + revision}px]" onClick={() => setCount(n => n + 1)}>
              revision-${revision}: {count}
            </button>;
          }
        `;

        try {
          await mkdir(componentDir, { recursive: true });
          await writeFile(resolve(componentDir, 'Probe.tsx'), component(0));
          // Overlapping public entries put the component in a shared Rollup chunk.
          await writeFile(
            resolve(componentDir, 'index.ts'),
            "export { Probe } from './Probe'; export const entry = 1;",
          );
          await writeFile(proxy, `export { Probe } from '../ds/components/${id}/Probe'; export const proxy = 1;`);

          // Match the library CLI's working directory and build environment.
          process.chdir(library);
          delete process.env.NODE_ENV;
          execFileSync(process.execPath, ['scripts/prune-dist.mjs'], { cwd: library });
          const result = await libraryVite.build({
            configFile: resolve(library, 'vite.config.ts'),
            mode: 'development',
            logLevel: 'silent',
            build: { watch: {}, emptyOutDir: false },
          });
          if (!('on' in result)) throw new Error('Expected a library watch build');
          const activeWatcher: Rollup.RollupWatcher = result;
          watcher = activeWatcher;
          activeWatcher.on('event', event => {
            if (event.code === 'END') builds++;
            if (event.code === 'ERROR') buildError = event.error;
          });
          await expect.poll(() => builds, { timeout: 60_000 }).toBeGreaterThan(0);

          // The app normally runs in a separate process from the build CLI.
          process.env.NODE_ENV = 'development';
          const configFile = resolve(appPackage, app.config);
          const loaded = await appVite.loadConfigFromFile({ command: 'serve', mode: 'development' }, configFile);
          const root = loaded?.config.root ?? appPackage;
          appFiles = ['html', 'tsx', 'app.tsx'].map(extension => resolve(root, `${id}.${extension}`));
          await writeFile(appFiles[0], `<div id="root"></div><script type="module" src="./${id}.tsx"></script>`);
          await writeFile(
            appFiles[1],
            `import { createRoot } from 'react-dom/client'; import { App } from './${id}.app';
             createRoot(document.getElementById('root')).render(<App />);`,
          );
          await writeFile(
            appFiles[2],
            `import { Probe } from '@mastra/playground-ui/components/${id}'; import '${app.css}';
             export function App() { return <Probe />; }`,
          );
          const devServer: ViteDevServer = await appVite.createServer({
            root,
            configFile,
            logLevel: 'silent',
            server: { host: '127.0.0.1', port: 0, strictPort: false, open: false },
            optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-runtime'] },
          });
          server = devServer;
          await devServer.listen();
          const address = devServer.httpServer?.address();
          if (!address || typeof address === 'string') throw new Error('Expected a TCP dev server');

          page.on('pageerror', error => browserErrors.push(error.message));
          page.on('websocket', socket => {
            socket.on('framereceived', event => {
              const message = JSON.parse(String(event.payload));
              if (message.type === 'full-reload') fullReloads.push(String(event.payload));
            });
          });
          await page.goto(`http://127.0.0.1:${address.port}/${id}.html`);
          const button = page.getByRole('button');
          await expect(button).toHaveCSS('width', `${firstWidth}px`);
          await button.click();
          await button.click();

          for (let revision = 1; revision <= 3; revision++) {
            const previousBuild = builds;
            await writeFile(resolve(componentDir, 'Probe.tsx'), component(revision));
            await expect
              .poll(
                () => {
                  if (buildError) throw buildError;
                  return builds;
                },
                { timeout: 30_000 },
              )
              .toBeGreaterThan(previousBuild);
            await expect(button).toHaveText(`revision-${revision}: 2`);
            await expect(button).toHaveCSS('width', `${firstWidth + revision}px`);
            // Vite debounces full reloads; allow those messages to arrive too.
            await page.waitForTimeout(250);
            expect(fullReloads).toEqual([]);
            expect(browserErrors).toEqual([]);
            await expect(button).toHaveText(`revision-${revision}: 2`);
          }
        } finally {
          await server?.close();
          await watcher?.close();
          process.chdir(cwd);
          if (nodeEnv === undefined) delete process.env.NODE_ENV;
          else process.env.NODE_ENV = nodeEnv;
          await Promise.all([componentDir, proxy, ...appFiles].map(file => rm(file, { recursive: true, force: true })));
        }
      });
    });
  }
});
