import { generateTypes } from './index.js';

/**
 * tsdown config with the repo's defaults for a published package: ESM and CommonJS output,
 * sourcemaps, tree-shaking and `node:` prefixes stripped. With `dts: false` (the default), the
 * declarations come from `generateTypes` once the build succeeds. Any tsdown option can be overridden.
 *
 * @param {import('./tsdown.d.ts').LibConfig} config
 * @returns {import('tsdown').UserConfig}
 */
export function defineLibConfig({ bundledTypes, ...config }) {
  const dts = config.dts ?? false;

  return {
    format: ['esm', 'cjs'],
    fixedExtension: false,
    nodeProtocol: 'strip',
    clean: true,
    treeshake: true,
    sourcemap: true,
    ...(dts
      ? {}
      : {
          onSuccess: async () => {
            await generateTypes(process.cwd(), new Set(bundledTypes));
          },
        }),
    ...config,
    dts,
  };
}
