import { dirname, join } from 'node:path';
import * as esbuild from 'esbuild';
import type { BuildContext, BuildOptions, Plugin } from 'esbuild';
import fsExtra from 'fs-extra';
import type { ToolUIRegistry } from '../plugins/extract-tool-ui';

export const STUDIO_SHARED_MODULES_GLOBAL = '__MASTRA_STUDIO_SHARED_MODULES__';

/**
 * Modules provided by Studio at runtime so tool components share its React instance, Mastra client and query cache.
 */
export const STUDIO_SHARED_MODULES = /^(react|react-dom|@mastra\/react|@tanstack\/react-query)(\/.*)?$/;

/** Where tool components are emitted, relative to the bundle output (served by Studio as `/tool-ui/<id>.js`). */
export function getToolUIOutputDir(bundleOutputDir: string) {
  return join(bundleOutputDir, 'studio', 'tool-ui');
}

const ENTRY_NAMESPACE = 'mastra-tool-ui-entry';
const SHARED_NAMESPACE = 'mastra-studio-shared';
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

function toolUIEntriesPlugin(registry: ToolUIRegistry): Plugin {
  return {
    name: 'mastra-tool-ui-entries',
    setup(build) {
      build.onResolve({ filter: new RegExp(`^${ENTRY_NAMESPACE}:`) }, args => ({
        path: args.path.slice(ENTRY_NAMESPACE.length + 1),
        namespace: ENTRY_NAMESPACE,
      }));
      build.onLoad({ filter: /.*/, namespace: ENTRY_NAMESPACE }, args => {
        const component = registry.get(args.path)!;
        const exported = IDENTIFIER.test(component.exportName)
          ? component.exportName
          : JSON.stringify(component.exportName);
        return {
          contents: `export { ${exported} as default } from ${JSON.stringify(component.source)};`,
          resolveDir: dirname(component.importer),
          loader: 'js',
        };
      });
    },
  };
}

function sharedModulesPlugin(): Plugin {
  return {
    name: 'mastra-studio-shared-modules',
    setup(build) {
      build.onResolve({ filter: STUDIO_SHARED_MODULES }, args => ({ path: args.path, namespace: SHARED_NAMESPACE }));
      // CommonJS so esbuild resolves named imports at runtime by property access, without knowing the export names.
      build.onLoad({ filter: /.*/, namespace: SHARED_NAMESPACE }, args => ({
        contents: [
          `const m = globalThis.${STUDIO_SHARED_MODULES_GLOBAL}?.[${JSON.stringify(args.path)}];`,
          `if (!m) throw new Error(${JSON.stringify(`Mastra Studio does not provide "${args.path}" to tool components`)});`,
          `module.exports = m;`,
        ].join('\n'),
        loader: 'js',
      }));
    },
  };
}

export interface BuildToolUIOptions {
  registry: ToolUIRegistry;
  /** Directory that receives `<id>.js` files, wiped before each build */
  outDir: string;
  projectRoot: string;
  minify?: boolean;
  /** Keep an esbuild context alive and rebuild when component files change */
  watch?: boolean;
}

/**
 * Bundles every `ui.studioComponent` recorded during the server build into a browser ESM file
 * at `<outDir>/<id>.js`, loaded lazily by Studio.
 */
export async function buildToolUI({
  registry,
  outDir,
  projectRoot,
  minify = false,
  watch = false,
}: BuildToolUIOptions): Promise<BuildContext | undefined> {
  await fsExtra.remove(outDir);

  if (registry.size === 0) {
    return undefined;
  }

  // Snapshot so later registry mutations (dev rebuilds) don't affect this build.
  const entries: ToolUIRegistry = new Map(registry);

  const options: BuildOptions = {
    entryPoints: [...entries.keys()].map(id => ({ in: `${ENTRY_NAMESPACE}:${id}`, out: id })),
    outdir: outDir,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    splitting: true,
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
    minify,
    logLevel: watch ? 'warning' : 'silent',
    absWorkingDir: projectRoot,
    define: {
      'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production'),
    },
    plugins: [toolUIEntriesPlugin(entries), sharedModulesPlugin()],
  };

  if (!watch) {
    await esbuild.build(options);
    return undefined;
  }

  const context = await esbuild.context(options);
  await context.rebuild();
  await context.watch();
  return context;
}
