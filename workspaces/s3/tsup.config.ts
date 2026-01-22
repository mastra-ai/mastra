import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false,
  clean: true,
  sourcemap: true,
  external: ['@mastra/core', '@aws-sdk/client-s3'],
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
