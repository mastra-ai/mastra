import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  deps: {
    neverBundle: ['@mastra/client-js', '@mastra/core', '@mastra/platform-workspace', '@mastra/stagehand'],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
