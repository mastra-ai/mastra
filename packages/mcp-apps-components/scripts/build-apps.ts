import { readdir, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Every folder in src/apps exporting `app` from app.tsx becomes apps-dist/<folder>.html, which
// tsdown then inlines as a string into the server helpers (see tsdown.config.ts).
//
// An MCP App is served as one HTML resource: hosts load it into a sandboxed iframe and never
// fetch sibling files, so every script, style and asset is inlined into the page. Inlining
// forbids several inputs per build, hence one build per app.
const runtimeDir = fileURLToPath(new URL('../src/runtime', import.meta.url));
const appsDir = fileURLToPath(new URL('../src/apps', import.meta.url));
const outDir = fileURLToPath(new URL('../apps-dist', import.meta.url));

const apps = (await readdir(appsDir, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(e => e.name);

await rm(outDir, { recursive: true, force: true });
for (const app of apps) {
  await build({
    configFile: false,
    logLevel: 'warn',
    root: runtimeDir,
    plugins: [
      {
        name: 'mcp-app-entry',
        transformIndexHtml: { order: 'pre', handler: html => html.replaceAll('__APP__', app) },
      },
      react(),
      tailwindcss(),
      viteSingleFile({ removeViteModuleLoader: true }),
    ],
    resolve: {
      // playground-ui and the apps must share one copy of each context-bearing package.
      dedupe: ['react', 'react-dom', '@tanstack/react-query', '@mastra/react', '@mastra/client-js'],
    },
    build: {
      outDir,
      // One build per app into the same folder, cleared once above.
      emptyOutDir: false,
      rollupOptions: {
        input: `${runtimeDir}/app.html`,
        treeshake: {
          // @modelcontextprotocol/client doesn't declare `sideEffects: false`, so its whole browser
          // build stays in the bundle even though `App` only uses `Protocol`. That includes the
          // unused @cfworker/json-schema validator, whose module-level `new URL(location…)` throws in
          // `blob:` documents (Studio's sandbox) and kills the app before it renders.
          moduleSideEffects: id => !id.includes('/@modelcontextprotocol/client/'),
        },
      },
    },
  });
  await rename(`${outDir}/app.html`, `${outDir}/${app}.html`);
  console.info(`Built apps-dist/${app}.html`);
}
