import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import nodeExternals from 'rollup-plugin-node-externals';
import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { libInjectCss } from 'vite-plugin-lib-inject-css';

const baseConfig: UserConfig = {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
};

const libConfig: UserConfig = {
  ...baseConfig,
  plugins: [
    ...(baseConfig.plugins ?? []),
    dts({
      insertTypesEntry: true,
    }),
    libInjectCss(),
    nodeExternals(),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        utils: resolve(__dirname, 'src/utils.ts'),
        tokens: resolve(__dirname, 'src/ds/tokens/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        return `${entryName}.${format}.js`;
      },
    },
    sourcemap: true,
    // Reduce bloat from legacy polyfills.
    target: 'esnext',
    // Leave minification up to applications.
    minify: false,
    rollupOptions: {
      external: ['motion/react'],
    },
  },
};

// Storybook sets STORYBOOK=true and bundles this package as an app.
// Library-mode plugins (dts, libInjectCss, nodeExternals) would externalize
// deps and break the static build, so we skip them when Storybook is running.
const isStorybook = process.env.STORYBOOK === 'true';

export default defineConfig(isStorybook ? baseConfig : libConfig);
