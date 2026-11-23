import { defineConfig } from 'tsdown';

const ADAPTER = ['@chat-adapter/telegram', '@chat-adapter/shared', 'chat'];

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    fixedExtension: false,
    nodeProtocol: 'strip',
    dts: { sourcemap: false },
    clean: true,
    deps: {
      neverBundle: ['@mastra/core'],
    },
  },
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    fixedExtension: false,
    nodeProtocol: 'strip',
    dts: false,
    clean: false,
    deps: {
      alwaysBundle: ADAPTER,
      onlyBundle: false,
      neverBundle: ['@mastra/core'],
    },
  },
]);
