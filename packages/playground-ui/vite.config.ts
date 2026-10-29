import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import nodeExternals from 'rollup-plugin-node-externals';
import type { Plugin, UserConfig } from 'vite';
import { defineConfig } from 'vite';
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

const toPosix = (path: string) => path.replace(/\\/g, '/');
const toImportPath = (path: string) => (path.startsWith('.') ? path : `./${path}`);

const runTsc = (args: string[]) =>
  new Promise<number>(resolveExit => {
    const child = spawn('tsc', args, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', error => {
      console.error(`Failed to run tsc: ${error.message}`);
      resolveExit(1);
    });
    child.on('close', code => resolveExit(code ?? 1));
  });

// Side-effect imports (CSS) are dropped and `@/` aliases made relative, so consumers resolve every import.
const sideEffectImportRE = /^import ['"][^'"]+['"];\r?\n/gm;
const aliasImportRE = /(from |import\()(['"])@\/([^'"]+)\2/g;

const finishDeclaration = async (file: string) => {
  const content = await readFile(file, 'utf8');
  const next = content
    .replace(sideEffectImportRE, '')
    .replace(
      aliasImportRE,
      (_, prefix, quote, path) =>
        `${prefix}${quote}${toImportPath(toPosix(relative(dirname(file), resolve(dtsSrcDir, path))))}${quote}`,
    );
  if (next !== content) await writeFile(file, next);
};

const forEachDeclaration = (directory: string, visit: (file: string) => void) => {
  readdirSync(directory, { withFileTypes: true }).forEach(dirent => {
    const path = resolve(directory, dirent.name);
    if (dirent.isDirectory()) forEachDeclaration(path, visit);
    else if (dirent.name.endsWith('.d.ts')) visit(path);
  });
};

const distDir = resolve(__dirname, 'dist');
const dtsTempDir = resolve(__dirname, 'node_modules/.cache/dts');
const dtsSrcDir = resolve(distDir, 'src');

// TypeScript 7 emits declarations while Vite bundles; vite-plugin-dts needs the TypeScript 6 compiler API and took ~14s.
// tsc writes to a temp dir because Vite empties `dist` when it writes the bundle. Type errors fail the build.
const typeDeclarations = (): Plugin => {
  let entries: Record<string, string> = {};
  let tsc: Promise<number> | undefined;

  return {
    name: 'playground-ui:dts',
    configResolved(config) {
      if (config.build.lib) entries = config.build.lib.entry as Record<string, string>;
    },
    // Rolldown runs buildStart once per output format but closeBundle once, so start tsc only once.
    buildStart() {
      tsc ??= rm(dtsTempDir, { recursive: true, force: true }).then(() =>
        runTsc(['-p', 'tsconfig.build.json', '--declarationDir', dtsTempDir]),
      );
    },
    async closeBundle() {
      const exitCode = await tsc;
      tsc = undefined;
      if (exitCode !== 0) throw new Error('tsc found type errors; see log above.');

      await rm(dtsSrcDir, { recursive: true, force: true });
      await rename(resolve(dtsTempDir, 'src'), dtsSrcDir);

      const declarations: string[] = [];
      forEachDeclaration(dtsSrcDir, file => declarations.push(file));
      await Promise.all(declarations.map(finishDeclaration));

      // Each lib entry gets a declaration next to its JS that re-exports the emitted source declaration.
      await Promise.all(
        Object.entries(entries).map(async ([name, source]) => {
          const entryFile = resolve(distDir, `${name}.d.ts`);
          const sourceFile = resolve(distDir, relative(__dirname, source)).replace(/\.tsx?$/, '.d.ts');
          const from = toImportPath(toPosix(relative(dirname(entryFile), sourceFile)).replace(/\.d\.ts$/, ''));
          const declaration = await readFile(sourceFile, 'utf8');
          const lines = [/^export /m.test(declaration) ? `export * from '${from}';` : 'export {};'];
          if (/^export default |^export \{[^}]*\bdefault\b/m.test(declaration)) {
            lines.push(`export { default } from '${from}';`);
          }

          await mkdir(dirname(entryFile), { recursive: true });
          await writeFile(entryFile, `${lines.join('\n')}\n`);
        }),
      );
    },
  };
};

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

// Tells the playground dev server (see its vite.config.ts) that `dist` is complete again after scripts/prune-dist.mjs.
// Any finished build qualifies, so a full build also clears a marker left by an interrupted watch.
const clearWatchPending = (): Plugin => ({
  name: 'clear-watch-pending',
  async closeBundle() {
    await rm(resolve(__dirname, 'node_modules/.cache/dev-watch-pending'), { force: true });
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
  plugins: [
    ...appPlugins,
    isProduction && typeDeclarations(),
    libInjectCss(),
    nodeExternals(),
    !isProduction && skipUnchangedWrites(),
    clearWatchPending(),
  ],
  build: {
    emptyOutDir: isProduction,
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
