import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import nodeExternals from 'rollup-plugin-node-externals';
import { defineConfig, type UserConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { libInjectCss } from 'vite-plugin-lib-inject-css';

const sharedConfig: UserConfig = {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
};

const libConfig: UserConfig = {
  ...sharedConfig,
  plugins: [...(sharedConfig.plugins ?? []), dts({ insertTypesEntry: true }), libInjectCss(), nodeExternals()],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        utils: resolve(__dirname, 'src/utils.ts'),
        tokens: resolve(__dirname, 'src/ds/tokens/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format}.js`,
    },
    sourcemap: true,
    target: 'esnext',
    minify: false,
    rollupOptions: {
      external: ['motion/react'],
    },
  },
};

// Storybook sets STORYBOOK=true and bundles this package as an app.
// Library-mode plugins (dts, libInjectCss, nodeExternals) would externalize
// deps and break the static build, so we serve a minimal config instead.
export default defineConfig(process.env.STORYBOOK === 'true' ? sharedConfig : libConfig);
