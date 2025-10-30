import originalEsbuild from 'rollup-plugin-esbuild';

export function esbuild(options: Parameters<typeof originalEsbuild>[0] = {}) {
  return originalEsbuild({
    target: 'node20',
    platform: 'node',
    minify: false,
    ...options,
  });
}
