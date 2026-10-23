import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts'],
  deps: {
    neverBundle: ['@mastra/core', '@aws-sdk/client-s3'],
  },
});
