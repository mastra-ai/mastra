import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { rollup, type InputOptions, type OutputOptions } from 'rollup';
import shim from 'rollup-plugin-shim';

interface BundleOptions {
  input?: Partial<InputOptions>;
  output?: Partial<OutputOptions>;
}

export async function bundleForCloudflare(
  input: string,
  outputFile: string,
  options: BundleOptions = {
    input: {},
    output: {},
  },
) {
  const fs = await import('fs');
  const fsOutput: string[] = [];
  Reflect.ownKeys(fs).forEach(key => {
    fsOutput.push(`export const ${String(key)} = () => {}`);
  });

  const rollupOptions: InputOptions = {
    ...options.input,
    input,
    plugins: [
      nodeResolve({
        browser: true,
      }),
      json(),
      commonjs(),
      shim({
        url: `const TMP = URL;
  export const parse = () => {}
  export const pathToFileURL = () => {}
    export {
    TMP as URL
  }
    
  `,
        child_process: `export default {}`,
        'node-fetch': `export default fetch`,
        'fs/promises': 'export const readFile = () => Promise.resolve("")',
        fs: fsOutput.join('\n'),
        crypto: `export default globalThis.crypto
  export const randomUUID = () => crypto.randomUUID()`,
      }),
    ],
    treeshake: 'smallest',
  };

  const bundle = await rollup(rollupOptions);

  await bundle.write({
    ...options.output,
    file: outputFile,
    format: 'esm',
    inlineDynamicImports: true,
  });
}
