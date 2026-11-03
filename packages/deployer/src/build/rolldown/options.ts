import type { InputOptions, PreRenderedChunk, TreeshakingOptions } from 'rolldown';
import type { BundlerPlatform } from '../utils';

/**
 * Rolldown's equivalent of Rollup's `treeshake: 'smallest'` preset. Rollup's `tryCatchDeoptimization` and
 * `correctVarValueBeforeDeclaration` have no Rolldown counterpart.
 */
export const TREESHAKE_SMALLEST: TreeshakingOptions = {
  moduleSideEffects: false,
  propertyReadSideEffects: false,
  unknownGlobalSideEffects: false,
  annotations: true,
};

/**
 * `tools.mjs` is the tools manifest written next to the bundle (`#tools` resolves to it as an external). Rolldown names
 * a shared chunk after the directory of an `index` module, so `src/mastra/tools/index.ts` would also become
 * `tools.mjs`. Lowercased because macOS and Windows filesystems are case-insensitive.
 */
export function chunkFileNames(chunk: PreRenderedChunk): string {
  return chunk.name.toLowerCase() === 'tools' ? '[name]-[hash].mjs' : '[name].mjs';
}

export const bundlerLogLevel = (): InputOptions['logLevel'] =>
  process.env.MASTRA_BUNDLER_DEBUG === 'true' ? 'debug' : 'silent';

/**
 * Resolution options mirroring what `@rollup/plugin-node-resolve` did before.
 *
 * - Bun builds (`neutral`) resolve like Node: Rolldown's `neutral` has no main fields and doesn't treat builtins as
 *   external.
 * - Rolldown's node default is `['main', 'module']`; node-resolve preferred `module`.
 * - Symlinks are followed by default: with pnpm, a package's own dependencies are only reachable from its real path.
 *   `preserveSymlinks` is for passes that only resolve the app's own files.
 */
export function getPlatformOptions(
  platform: BundlerPlatform,
  { modules, preserveSymlinks = false }: { modules?: string[]; preserveSymlinks?: boolean } = {},
): Pick<InputOptions, 'platform' | 'resolve'> {
  const resolveModules = modules?.length ? ['node_modules', ...modules] : undefined;
  const shared = {
    ...(preserveSymlinks ? { symlinks: false } : {}),
    ...(resolveModules ? { modules: resolveModules } : {}),
  };

  if (platform === 'browser') {
    return {
      platform: 'browser',
      resolve: {
        mainFields: ['browser', 'module', 'main'],
        conditionNames: ['browser', 'worker', 'import', 'module', 'default'],
        ...shared,
      },
    };
  }

  return {
    platform: 'node',
    resolve: {
      mainFields: ['module', 'main'],
      ...shared,
    },
  };
}

/**
 * Replaces `@rollup/plugin-esm-shim`: CommonJS globals become their `import.meta` equivalents (Node >= 20.11).
 * `require` doesn't need a shim, Rolldown emits a `createRequire(import.meta.url)` polyfill for `platform: 'node'`.
 */
export function cjsGlobalsDefine(enabled: boolean, platform: BundlerPlatform): Record<string, string> {
  if (!enabled || platform === 'browser') {
    return {};
  }

  return {
    __dirname: 'import.meta.dirname',
    __filename: 'import.meta.filename',
  };
}
