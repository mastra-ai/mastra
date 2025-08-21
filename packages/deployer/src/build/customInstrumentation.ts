import { rollup } from 'rollup';
import { esbuild } from './plugins/esbuild';
import commonjs from '@rollup/plugin-commonjs';

export function getCustomInstrumentationBundler(
  entryFile: string,
  result: {
    hasCustomConfig: false;
  },
) {
  return rollup({
    logLevel: 'silent',
    input: {
      instrumentation: entryFile,
    },
    treeshake: false,
    plugins: [
      // transpile typescript to something we understand
      esbuild(),
      commonjs({
        extensions: ['.js', '.ts'],
        strictRequires: 'strict',
        transformMixedEsModules: true,
        ignoreTryCatch: false,
      }),
    ],
  });
}

export async function writeCustomInstrumentation(
  entryFile: string,
  outputDir: string,
  options: {
    sourcemap?: boolean;
  } = {},
): Promise<{
  hasCustomConfig: boolean;
  externalDependencies: string[];
}> {
  const result = {
    hasCustomConfig: false,
  } as const;

  const bundle = await getCustomInstrumentationBundler(entryFile, result);

  const { output } = await bundle.write({
    dir: outputDir,
    format: 'es',
    entryFileNames: '[name].mjs',
    sourcemap: options.sourcemap,
  });
  const externals = output[0].imports.filter(x => !x.startsWith('./'));

  return { ...result, externalDependencies: externals };
}
