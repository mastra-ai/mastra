import { builtinModules } from 'node:module';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

// As in Studio, core's shared chunks contain unreachable Node-only imports.
const browserStubs: Plugin = {
  name: 'studio-browser-stubs',
  enforce: 'pre',
  apply: 'build',
  resolveId(source) {
    const name = source.replace(/^node:/, '').split('/')[0];
    if (name && (builtinModules.includes(name) || source === 'execa')) {
      return { id: `\0studio-node:${source}`, moduleSideEffects: false };
    }
  },
  load(id) {
    if (id.startsWith('\0studio-node:')) return { code: 'export default {}', syntheticNamedExports: true };
  },
};

const embeddedApp: Plugin = {
  name: 'studio-embedded-app',
  enforce: 'post',
  generateBundle: {
    order: 'post',
    handler(_options, bundle) {
      const output = Object.values(bundle);
      const script = output
        .filter(item => item.type === 'chunk')
        .map(item => item.code)
        .join('\n');
      const css = output
        .flatMap(item => (item.type === 'asset' && item.fileName.endsWith('.css') ? [item.source] : []))
        .join('\n');
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mastra Studio</title><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="root"></div><script id="mastra-studio-configuration" type="application/json">__MASTRA_STUDIO_MCP_CONFIG__</script><script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
      // A JS string is bundled into @mastra/server. No runtime file lookup, CDN,
      // separately copied assets, or dependency on this private package at runtime.
      for (const name of Object.keys(bundle)) delete bundle[name];
      this.emitFile({
        type: 'asset',
        fileName: 'index.js',
        source: `export const studioHtml = ${JSON.stringify(html)};\n`,
      });
      this.emitFile({ type: 'asset', fileName: 'index.d.ts', source: 'export declare const studioHtml: string;\n' });
    },
  },
};

export default defineConfig(({ command }) => ({
  define: command === 'build' ? { 'process.env.NODE_ENV': JSON.stringify('production') } : {},
  plugins: [browserStubs, react(), tailwindcss(), embeddedApp],
  resolve: { dedupe: ['react', 'react-dom'] },
  build: {
    lib: { entry: 'src/main.tsx', name: 'MastraStudio', formats: ['iife'] },
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
}));
