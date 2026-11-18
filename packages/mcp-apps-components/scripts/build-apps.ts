import { readFile, readdir, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import type { Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Every folder in src/apps (an index.html and its scripts) becomes apps-dist/<folder>.html, which
// tsdown then inlines as a string into the package (see tsdown.config.ts).
//
// An MCP App is served as one HTML resource: hosts load it into a sandboxed iframe and never
// fetch sibling files, so every script, style and asset is inlined into the page. Inlining
// forbids several inputs per build, hence one build per app.
const appsDir = fileURLToPath(new URL('../src/apps', import.meta.url));
const outDir = fileURLToPath(new URL('../apps-dist', import.meta.url));

const shared = (file: string) => fileURLToPath(new URL(`../src/shared/${file}`, import.meta.url));

/**
 * Swaps two heavy Studio dependencies for light stand-ins, which more than halves the trace viewer:
 * - span details draw each tool call with the chat's `MessageRow`, which brings the whole chat (forms, workflow
 *   graphs, nested MCP App hosting); apps draw tool calls as JSON.
 * - the code editor pretty-prints with prettier; apps only need JSON, which `JSON.stringify` formats.
 */
const lightStudio: Plugin = {
  name: 'mastra-light-studio',
  enforce: 'pre',
  resolveId(source, importer) {
    if (!importer?.includes('/playground-ui/')) return null;
    if (/\/chat\/messages\/message-row(\.es)?\.js$/.test(source)) return shared('tool-call-row.tsx');
    if (source.startsWith('prettier/')) return shared('prettier-lite.ts');
    return null;
  },
};

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

const apps = (await readdir(appsDir, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(e => e.name);

await rm(outDir, { recursive: true, force: true });
for (const app of apps) {
  const root = `${appsDir}/${app}`;
  await build({
    configFile: false,
    logLevel: 'warn',
    root,
    plugins: [lightStudio, react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true })],
    // Apps report the package's version to the host when they connect.
    define: { __PACKAGE_VERSION__: JSON.stringify(version) },
    resolve: {
      // playground-ui and the apps must share one copy of each context-bearing package.
      dedupe: ['react', 'react-dom', '@tanstack/react-query', '@mastra/react', '@mastra/client-js'],
    },
    build: {
      outDir,
      // One build per app into the same folder, cleared once above.
      emptyOutDir: false,
      rollupOptions: {
        input: `${root}/index.html`,
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
  await rename(`${outDir}/index.html`, `${outDir}/${app}.html`);
  console.info(`Built apps-dist/${app}.html`);
}
