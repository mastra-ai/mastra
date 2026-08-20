import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  deps: {
    alwaysBundle: ['@internal/agent-sdk-base'],
    neverBundle: ['@opencode-ai/sdk'],
  },
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd(), new Set(['@internal/agent-sdk-base']));
  },
});
