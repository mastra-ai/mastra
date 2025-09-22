import { rollup, type Plugin } from 'rollup';
import { DEPS_TO_IGNORE } from './constants';
import { tsConfigPaths } from '../plugins/tsconfig-paths';
import { esbuild } from '../plugins/esbuild';
import json from '@rollup/plugin-json';
import { commonjs } from '../plugins/commonjs';

/**
 * Configures and returns the Rollup plugins needed for analyzing entry files.
 * Sets up module resolution, transpilation, and custom alias handling for Mastra-specific imports.
 */
function getInputPlugins(): Plugin[] {
  const plugins: Plugin[] = [];

  plugins.push(...[tsConfigPaths(), json(), esbuild(), commonjs()]);

  return plugins;
}

/**
 * Convert the entry file and tools into a single entry file so we can improve our analysis and already treeshake all unused imports.
 *
 * @param entry - The entry file to generate
 * @param tools - The tools to generate
 * @param outputDirectory - The output directory to generate
 * @returns
 */
export async function generateEntry(entry: string, tools: Record<string, string>, outputDirectory: string) {
  const bundler = await rollup({
    logLevel: process.env.MASTRA_BUNDLER_DEBUG === 'true' ? 'debug' : 'silent',
    input: {
      entry,
      ...tools,
    },
    treeshake: 'smallest',
    preserveSymlinks: true,
    plugins: getInputPlugins(),
    external: DEPS_TO_IGNORE,
  });

  const { output } = await bundler.write({ format: 'esm', sourcemap: true, dir: outputDirectory });

  await bundler.close();

  return output;
}
