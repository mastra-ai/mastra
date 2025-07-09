import * as babel from '@babel/core';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import commonjs from '@rollup/plugin-commonjs';
import { recursiveRemoveNonReferencedNodes } from './plugins/remove-unused-references';

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
      esbuild({
        target: 'node20',
        platform: 'node',
        minify: false,
      }),
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
  });
  const externals = output[0].imports.filter(x => !x.startsWith('./'));

  return { ...result, externalDependencies: externals };
}
