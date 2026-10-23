import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts', 'src/blob/index.ts'],
  deps: {
    neverBundle: ['@mastra/core', '@azure/storage-blob', '@azure/identity'],
  },
});
