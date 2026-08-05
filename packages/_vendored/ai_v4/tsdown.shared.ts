export const sharedConfig = {
  format: 'esm' as const,
  fixedExtension: false,
  nodeProtocol: 'strip' as const,
  target: 'node22' as const,
  dts: false,
  treeshake: true,
  sourcemap: true,
  deps: {},
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
};
