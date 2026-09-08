import { existsSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import nodeExternals from 'rollup-plugin-node-externals';
import type { PluginOption, UserConfig } from 'vite';
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

// One entry per source file, published as `@mastra/playground-ui/<prefix>/<path>`:
// `src/hooks/use-is-mobile.ts` becomes `hooks/use-is-mobile`. A folder's index.ts
// takes the folder's own name, and a root barrel would collide with the prefix,
// so it is left out.
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

// One entry per design-system component folder holding an index.ts, published as
// `components/<Name>` or a nested `components/ai/plan`. The walk stops at that
// index.ts — deeper folders are the component's internals, already re-exported by
// its barrel — and folders without one only group files.
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

// vite-plugin-dts only logs type errors. It is the package's single TypeScript pass
// since `build` dropped its standalone tsc, so make diagnostics fail the build.
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

// The `dev` watch layers fresh JS over a previous full build: declarations cost ~7s
// per rebuild, so it skips them and leaves the ones on disk alone — consumers resolve
// their types from there.
const createLibConfig = (isProduction: boolean): UserConfig => ({
  ...baseConfig,
  plugins: [...appPlugins, isProduction && typeDeclarations(), libInjectCss(), nodeExternals() as PluginOption],
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
      },
      formats: ['es', 'cjs'],
      // Slashed keys make Rollup emit nested output: dist/components/<Name>.<format>.js
      fileName: (format, entryName) => `${entryName}.${format}.js`,
    },
    sourcemap: true,
    // Reduce bloat from legacy polyfills.
    target: 'esnext',
    // Leave minification up to applications.
    minify: false,
    rollupOptions: {
      external: ['motion/react'],
      output: {
        // With ~300 entries, hoisted transitive imports would bloat every entry
        // chunk with empty side-effect imports of shared chunks.
        hoistTransitiveImports: false,
      },
    },
  },
});

// Storybook sets STORYBOOK=true and bundles this package as an app.
// Library-mode plugins (dts, libInjectCss, nodeExternals) would externalize
// deps and break the static build, so we skip them when Storybook is running.
const isStorybook = process.env.STORYBOOK === 'true';

export default defineConfig(({ mode }) => (isStorybook ? baseConfig : createLibConfig(mode === 'production')));
