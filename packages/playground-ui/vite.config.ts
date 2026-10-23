import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import nodeExternals from 'rollup-plugin-node-externals';
import type { Plugin, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import { libInjectCss } from 'vite-plugin-lib-inject-css';
import { libEntries, srcDir } from './lib-entries.ts';

const readWrittenOutput = (path: string) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
};

// Watch rebuilds rewrite every output file; each identical rewrite still reaches consuming dev servers as an HMR update.
const skipUnchangedWrites = (): Plugin => ({
  name: 'skip-unchanged-writes',
  enforce: 'post',
  generateBundle: {
    order: 'post',
    handler({ dir }, bundle) {
      if (!dir) return;

      for (const [fileName, output] of Object.entries(bundle)) {
        const content = output.type === 'chunk' ? output.code : output.source;
        if (readWrittenOutput(resolve(dir, fileName)) === content) delete bundle[fileName];
      }
    },
  },
});

const appPlugins = [react(), tailwindcss()];

const baseConfig: UserConfig = {
  plugins: appPlugins,
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
};

// Watch builds reuse the previous full build declarations.
const createLibConfig = (isProduction: boolean): UserConfig => ({
  ...baseConfig,
  plugins: [...appPlugins, libInjectCss(), nodeExternals(), !isProduction && skipUnchangedWrites()],
  build: {
    emptyOutDir: isProduction,
    lib: {
      entry: libEntries(),
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format}.js`,
    },
    sourcemap: true,
    target: 'esnext',
    minify: false,
    rolldownOptions: {
      output: {
        hoistTransitiveImports: false,
        // Stable module URLs let React Fast Refresh retain state across watch builds.
        ...(!isProduction && { chunkFileNames: '[name].[format].js' }),
      },
    },
  },
});

// Library plugins externalize dependencies and break Storybook.
const isStorybook = process.env.STORYBOOK === 'true';

export default defineConfig(({ mode }) => (isStorybook ? baseConfig : createLibConfig(mode === 'production')));
