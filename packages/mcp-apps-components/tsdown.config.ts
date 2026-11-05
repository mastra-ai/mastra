import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

const RAW = '?raw';

// Builds the server-side helpers once `scripts/build-apps.ts` has built each iframe app into
// `apps-dist/`. Each helper imports its app's page with `?raw`, which inlines the HTML as a string,
// so the helpers carry no file reference that bundling could break.
export default defineConfig({
  entry: ['src/dashboard-renderer.ts', 'src/dashboard-data-tool.ts', 'src/host.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  // Only the iframe apps import these, and `scripts/build-apps.ts` bundles them into the HTML.
  deps: {
    alwaysBundle: ['@mastra/playground-ui', '@mastra/react'],
  },
  plugins: [
    {
      name: 'raw-html',
      resolveId(source, importer) {
        if (!source.endsWith(RAW) || !importer) return null;
        return resolve(dirname(importer), source.slice(0, -RAW.length)) + RAW;
      },
      async load(id) {
        if (!id.endsWith(RAW)) return null;
        const html = await readFile(id.slice(0, -RAW.length), 'utf-8');
        return `export default ${JSON.stringify(html)};`;
      },
    },
  ],
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
