import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import nodeExternals from 'rollup-plugin-node-externals';
import type { PluginOption, UserConfig } from 'vite';
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
      exclude: ['vite.config.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/__tests__/**'],
      // vite-plugin-dts logs type errors but does not fail the build on its own.
      // Since this is now the single TypeScript pass (the standalone `tsc` step
      // was removed from `build`), fail the build when diagnostics are emitted so
      // type errors still gate the bundle.
      afterDiagnostic: diagnostics => {
        if (diagnostics.length > 0) {
          throw new Error(`vite-plugin-dts found ${diagnostics.length} type error(s); see log above.`);
        }
      },
    }),
    libInjectCss(),
    nodeExternals() as PluginOption,
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
