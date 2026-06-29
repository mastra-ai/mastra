import { existsSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import nodeExternals from 'rollup-plugin-node-externals';
import type { PluginOption, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { libInjectCss } from 'vite-plugin-lib-inject-css';

// One library entry per design-system component folder, exposed publicly as
// `@mastra/playground-ui/components/<Name>` (see the `./components/*` exports
// wildcard in package.json). Deep imports let consumers skip the root barrel
// so bundlers only pull the components they use.
const componentsDir = resolve(__dirname, 'src/ds/components');
const componentEntries = Object.fromEntries(
  readdirSync(componentsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => [`components/${dirent.name}`, resolve(componentsDir, dirent.name, 'index.ts')] as const)
    .filter(([, file]) => {
      if (existsSync(file)) return true;
      console.warn(`[playground-ui] skipping component without index.ts: ${file}`);
      return false;
    }),
);

// Public hook subpath entries, exposed as
// `@mastra/playground-ui/hooks/<hook-file>` via the `./hooks/*` package export.
const hooksDir = resolve(__dirname, 'src/hooks');
const hookEntries = Object.fromEntries(
  readdirSync(hooksDir, { withFileTypes: true })
    .filter(dirent => dirent.isFile())
    .map(dirent => dirent.name)
    .filter(
      fileName => /\.(ts|tsx)$/.test(fileName) && !fileName.endsWith('.test.tsx') && !fileName.endsWith('.test.ts'),
    )
    .map(fileName => {
      const entryName = fileName.replace(/\.(ts|tsx)$/, '');
      return [`hooks/${entryName}`, resolve(hooksDir, fileName)] as const;
    }),
);

// Public utility subpath entries, exposed as
// `@mastra/playground-ui/utils/<utility-file>` via the `./utils/*` package export.
const utilsDir = resolve(__dirname, 'src/utils');
const utilityEntries = Object.fromEntries(
  readdirSync(utilsDir, { withFileTypes: true })
    .filter(dirent => dirent.isFile())
    .map(dirent => dirent.name)
    .filter(
      fileName => /\.(ts|tsx)$/.test(fileName) && !fileName.endsWith('.test.tsx') && !fileName.endsWith('.test.ts'),
    )
    .map(fileName => {
      const entryName = fileName.replace(/\.(ts|tsx)$/, '');
      return [`utils/${entryName}`, resolve(utilsDir, fileName)] as const;
    }),
);

const createPublicFileEntries = (sourceDir: string, entryPrefix: string) => {
  const entries: Array<readonly [string, string]> = [];

  const walk = (currentDir: string) => {
    readdirSync(currentDir, { withFileTypes: true }).forEach(dirent => {
      if (dirent.isDirectory()) {
        if (dirent.name === '__tests__') return;
        walk(resolve(currentDir, dirent.name));
        return;
      }

      if (!dirent.isFile()) return;

      const fileName = dirent.name;
      if (
        !/\.(ts|tsx)$/.test(fileName) ||
        fileName.endsWith('.test.ts') ||
        fileName.endsWith('.test.tsx') ||
        fileName.endsWith('.stories.ts') ||
        fileName.endsWith('.stories.tsx')
      ) {
        return;
      }

      const file = resolve(currentDir, fileName);
      const entryName = relative(sourceDir, file)
        .replace(/\\/g, '/')
        .replace(/\.(ts|tsx)$/, '')
        .replace(/(?:^|\/)index$/, '');

      if (!entryName) return;

      entries.push([`${entryPrefix}/${entryName}`, file] as const);
    });
  };

  walk(sourceDir);

  return Object.fromEntries(entries);
};

const domainEntries = createPublicFileEntries(resolve(__dirname, 'src/domains'), 'domains');
const eeEntries = createPublicFileEntries(resolve(__dirname, 'src/ee'), 'ee');
const primitiveEntries = createPublicFileEntries(resolve(__dirname, 'src/ds/primitives'), 'primitives');
const resizeEntries = createPublicFileEntries(resolve(__dirname, 'src/lib/resize'), 'resize');
const storeEntries = createPublicFileEntries(resolve(__dirname, 'src/store'), 'store');

// Public icon subpath entries, exposed as
// `@mastra/playground-ui/icons/<IconName>` via the `./icons/*` package export.
const iconsDir = resolve(__dirname, 'src/ds/icons');
const iconEntries = Object.fromEntries(
  readdirSync(iconsDir, { withFileTypes: true })
    .filter(dirent => dirent.isFile())
    .map(dirent => dirent.name)
    .filter(
      fileName =>
        /\.(ts|tsx)$/.test(fileName) &&
        fileName !== 'index.ts' &&
        !fileName.endsWith('.stories.tsx') &&
        !fileName.endsWith('.test.tsx') &&
        !fileName.endsWith('.test.ts'),
    )
    .map(fileName => {
      const entryName = fileName.replace(/\.(ts|tsx)$/, '');
      return [`icons/${entryName}`, resolve(iconsDir, fileName)] as const;
    }),
);

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
        // Slashed keys make Rollup emit nested output: dist/components/<Name>.<format>.js
        ...utilityEntries,
        ...domainEntries,
        ...eeEntries,
        ...primitiveEntries,
        ...resizeEntries,
        ...storeEntries,
        ...iconEntries,
        ...componentEntries,
        ...hookEntries,
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
      output: {
        // With ~300 entries, hoisted transitive imports would bloat every entry
        // chunk with empty side-effect imports of shared chunks.
        hoistTransitiveImports: false,
        // Pin the global Tailwind stylesheet to a chunk named `index` so its
        // compiled CSS keeps emitting as dist/index.css — the target of the
        // public `./style.css` export. With many entries Rollup would
        // otherwise attach it to an arbitrary shared chunk (and an arbitrary
        // .css filename), breaking the export.
        manualChunks(id) {
          if (id === resolve(__dirname, 'src/index.css')) return 'index';
        },
      },
    },
  },
};

// Storybook sets STORYBOOK=true and bundles this package as an app.
// Library-mode plugins (dts, libInjectCss, nodeExternals) would externalize
// deps and break the static build, so we skip them when Storybook is running.
const isStorybook = process.env.STORYBOOK === 'true';

export default defineConfig(isStorybook ? baseConfig : libConfig);
