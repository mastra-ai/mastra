import originalCommonjs from '@rollup/plugin-commonjs';

export function commonjs(options: Parameters<typeof originalCommonjs>[0] = {}) {
  return originalCommonjs({
    strictRequires: 'debug',
    ignoreTryCatch: false,
    transformMixedEsModules: true,
    extensions: ['.js', '.ts'],
    ...options,
  });
}
