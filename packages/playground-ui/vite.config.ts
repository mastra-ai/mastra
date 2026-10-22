import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import nodeExternals from 'rollup-plugin-node-externals';
import type { Plugin, UserConfig } from 'vite';
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
    exclude: [
      'vite.config.ts',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/*.stories.ts',
      'src/**/*.stories.tsx',
      'src/**/__tests__/**',
      'src/test/**',
      '.storybook/**',
    ],
    afterDiagnostic: diagnostics => {
      if (diagnostics.length > 0) {
        throw new Error(`vite-plugin-dts found ${diagnostics.length} type error(s); see log above.`);
      }
    },
  });

const distDir = resolve(__dirname, 'dist');
// Same depth as `dist`, so the relative source paths in sourcemaps stay valid after publishing.
const devStagingDir = resolve(__dirname, '.dist-dev');

const listFiles = (directory: string, files: string[] = []) => {
  if (!existsSync(directory)) return files;
  readdirSync(directory, { withFileTypes: true }).forEach(dirent => {
    const path = resolve(directory, dirent.name);
    if (dirent.isDirectory()) listFiles(path, files);
    else files.push(path);
  });
  return files;
};

// Studio and Factory serve `dist` while the watch rebuilds it. Rollup rewrites every file on each rebuild,
// changed or not, and each rewrite makes their Vite hot-update that module. A page loading at that moment
// can import two copies of it, e.g. two Sidebar contexts ("useSidebar must be used within a
// SidebarProvider"), and files read mid-write are served half-written. Watch builds write to a staging
// folder instead, and each finished build is copied into `dist` in one pass: only files whose content
// changed, each through a temp file and a rename, shared chunks before the entries that import them, and
// files the build no longer emits removed last. Declarations from the last full build stay.
const publishDevBuild = (): Plugin => {
  const emitted = new Map<string, boolean>();
  let outDir = devStagingDir;
  let failed = false;

  return {
    name: 'publish-dev-build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    buildStart() {
      emitted.clear();
      failed = false;
    },
    buildEnd(error) {
      if (error) failed = true;
    },
    renderError() {
      failed = true;
    },
    writeBundle(_options, bundle) {
      Object.values(bundle).forEach(output => {
        const isEntry = output.type === 'chunk' && output.isEntry;
        emitted.set(output.fileName, isEntry);
        if (output.type === 'chunk' && output.map) emitted.set(`${output.fileName}.map`, isEntry);
      });
    },
    closeBundle() {
      // Rollup also closes a failed build, even when one format was already written: keep the last good
      // build in `dist`.
      if (outDir === distDir || failed || emitted.size === 0) return;

      const changed = [...emitted]
        .sort(([, aIsEntry], [, bIsEntry]) => Number(aIsEntry) - Number(bIsEntry))
        .map(([fileName]) => fileName)
        .filter(fileName => {
          const target = resolve(distDir, fileName);
          return !existsSync(target) || !readFileSync(target).equals(readFileSync(resolve(outDir, fileName)));
        });

      changed.forEach(fileName => {
        const target = resolve(distDir, fileName);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(`${target}.tmp`, readFileSync(resolve(outDir, fileName)));
        renameSync(`${target}.tmp`, target);
      });

      listFiles(distDir).forEach(path => {
        const fileName = relative(distDir, path).replace(/\\/g, '/');
        if (!fileName.endsWith('.d.ts') && !emitted.has(fileName)) rmSync(path);
      });
    },
  };
};

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
  plugins: [...appPlugins, isProduction ? typeDeclarations() : publishDevBuild(), libInjectCss(), nodeExternals()],
  build: {
    outDir: isProduction ? distDir : devStagingDir,
    emptyOutDir: true,
    lib: {
      entry: {
        style: resolve(srcDir, 'style.ts'),
        tokens: resolve(srcDir, 'ds/tokens/index.ts'),
        'lib/framework': resolve(srcDir, 'lib/framework.tsx'),
        ...fileEntries('src/utils', 'utils'),
        ...fileEntries('src/domains', 'domains'),
        ...fileEntries('src/ee', 'ee'),
        ...fileEntries('src/ds/primitives', 'primitives'),
        ...fileEntries('src/lib/resize', 'resize'),
        ...fileEntries('src/lib/keyboard', 'keyboard'),
        ...fileEntries('src/lib/sort', 'sort'),
        ...fileEntries('src/components', 'components'),
        ...fileEntries('src/ds/icons', 'icons'),
        ...fileEntries('src/hooks', 'hooks'),
        ...fileEntries('src/lib/form', 'lib/form'),
        ...componentEntries('src/ds/components', 'components'),
        ...componentEntries('src/ds/layout', 'layout'),
        ...componentEntries('src/ds/new', 'new'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format}.js`,
    },
    sourcemap: true,
    target: 'esnext',
    minify: false,
    rollupOptions: {
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
