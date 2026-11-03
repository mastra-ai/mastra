import { readdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Every folder in src/apps exporting `app` from app.tsx becomes dist/<folder>.html.
//
// An MCP App is served as one HTML resource: hosts load it into a sandboxed iframe and never
// fetch sibling files, so every script, style and asset is inlined into the page. Inlining
// forbids several inputs per build, hence one build per app.
const runtimeDir = fileURLToPath(new URL('../src/runtime', import.meta.url));
const appsDir = fileURLToPath(new URL('../src/apps', import.meta.url));
const outDir = fileURLToPath(new URL('../dist', import.meta.url));

const apps = (await readdir(appsDir, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(e => e.name);

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
      // `tsdown` writes the server helpers into `dist/` first.
      emptyOutDir: false,
      rollupOptions: { input: `${runtimeDir}/app.html` },
    },
  });
  await rename(`${outDir}/app.html`, `${outDir}/${app}.html`);
  console.info(`Built dist/${app}.html`);
}
