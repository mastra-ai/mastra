import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import { resolve } from 'node:path';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { libInjectCss } from 'vite-plugin-lib-inject-css';
import nodeExternals from 'rollup-plugin-node-externals';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
    }),
    libInjectCss(),
    nodeExternals(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        utils: resolve(__dirname, 'src/utils.ts'),
        tokens: resolve(__dirname, 'src/ds/tokens/index.ts'),
        'tailwind.preset': resolve(__dirname, 'tailwind.preset.ts'),
        agents: resolve(__dirname, 'src/agents.ts'),
        workflows: resolve(__dirname, 'src/workflows.ts'),
        datasets: resolve(__dirname, 'src/datasets.ts'),
        observability: resolve(__dirname, 'src/observability.ts'),
        tools: resolve(__dirname, 'src/tools.ts'),
        mcps: resolve(__dirname, 'src/mcps.ts'),
        scores: resolve(__dirname, 'src/scores.ts'),
        processors: resolve(__dirname, 'src/processors.ts'),
        templates: resolve(__dirname, 'src/templates.ts'),
        workspace: resolve(__dirname, 'src/workspace.ts'),
        'prompt-blocks': resolve(__dirname, 'src/prompt-blocks.ts'),
        cms: resolve(__dirname, 'src/cms.ts'),
        configuration: resolve(__dirname, 'src/configuration.ts'),
        'request-context': resolve(__dirname, 'src/request-context.ts'),
        auth: resolve(__dirname, 'src/auth.ts'),
        llm: resolve(__dirname, 'src/llm.ts'),
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
});
