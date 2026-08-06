import type { UserConfig } from 'tsdown';

export const sharedConfig = {
  format: 'esm',
  fixedExtension: false,
  nodeProtocol: 'strip',
  target: 'node22',
  dts: false,
  treeshake: true,
  sourcemap: true,
  deps: {},
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
} satisfies UserConfig;
