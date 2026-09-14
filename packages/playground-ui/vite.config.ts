import { existsSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import nodeExternals from 'rollup-plugin-node-externals';
import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { libInjectCss } from 'vite-plugin-lib-inject-css';

const srcDir = resolve(__dirname, 'src');

const isEntrySource = (fileName: string) => /\.(ts|tsx)$/.test(fileName) && !/\.(test|stories)\.tsx?$/.test(fileName);

const forEachSourceFile = (directory: string, visit: (file: string) => void) => {
  readdirSync(directory, { withFileTypes: true }).forEach(dirent => {
    if (dirent.name === '__tests__') return;

    const path = resolve(directory, dirent.name);
    if (dirent.isDirectory()) forEachSourceFile(path, visit);
    else if (dirent.isFile() && isEntrySource(dirent.name)) visit(path);
  });
};

const fileEntries = (directory: string, prefix: string) => {
  const sourceDir = resolve(__dirname, directory);
  const entries: Array<[string, string]> = [];

  forEachSourceFile(sourceDir, file => {
    const entryName = relative(sourceDir, file)
      .replace(/\\/g, '/')
      .replace(/\.(ts|tsx)$/, '')
      .replace(/(?:^|\/)index$/, '');

    if (entryName) entries.push([`${prefix}/${entryName}`, file]);
  });

  return Object.fromEntries(entries);
};

const componentEntries = (directory: string, prefix: string) => {
  const sourceDir = resolve(__dirname, directory);
  const entries: Array<[string, string]> = [];

  const walk = (currentDir: string) => {
    readdirSync(currentDir, { withFileTypes: true }).forEach(dirent => {
      if (!dirent.isDirectory() || dirent.name === '__tests__') return;

      const folder = resolve(currentDir, dirent.name);
      const indexFile = resolve(folder, 'index.ts');

      if (!existsSync(indexFile)) {
        walk(folder);
        return;
      }

      entries.push([`${prefix}/${relative(sourceDir, folder).replace(/\\/g, '/')}`, indexFile]);
    });
  };

  walk(sourceDir);

  return Object.fromEntries(entries);
};

// vite-plugin-dts logs diagnostics unless afterDiagnostic fails the build.
const typeDeclarations = () =>
  dts({
    insertTypesEntry: true,
    exclude: ['vite.config.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/__tests__/**'],
    afterDiagnostic: diagnostics => {
      if (diagnostics.length > 0) {
        throw new Error(`vite-plugin-dts found ${diagnostics.length} type error(s); see log above.`);
      }
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
  plugins: [...appPlugins, isProduction && typeDeclarations(), libInjectCss(), nodeExternals()],
  build: {
    emptyOutDir: isProduction,
    lib: {
      entry: {
        style: resolve(srcDir, 'style.ts'),
        tokens: resolve(srcDir, 'ds/tokens/index.ts'),
        ...fileEntries('src/utils', 'utils'),
        ...fileEntries('src/domains', 'domains'),
        ...fileEntries('src/ee', 'ee'),
        ...fileEntries('src/ds/primitives', 'primitives'),
        ...fileEntries('src/lib/resize', 'resize'),
        ...fileEntries('src/lib/keyboard', 'keyboard'),
        ...fileEntries('src/store', 'store'),
        ...fileEntries('src/ds/icons', 'icons'),
        ...fileEntries('src/hooks', 'hooks'),
        ...componentEntries('src/ds/components', 'components'),
        ...componentEntries('src/ds/new', 'new'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format}.js`,
    },
    sourcemap: true,
    target: 'esnext',
    minify: false,
    rollupOptions: {
      external: ['motion/react'],
      output: {
        hoistTransitiveImports: false,
      },
    },
  },
});

// Library plugins externalize dependencies and break Storybook.
const isStorybook = process.env.STORYBOOK === 'true';

export default defineConfig(({ mode }) => (isStorybook ? baseConfig : createLibConfig(mode === 'production')));
