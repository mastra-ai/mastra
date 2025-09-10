import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/server/handlers.ts',
    'src/server/handlers/*.ts',
    'src/server/a2a/store.ts',
    '!src/server/handlers/*.test.ts',
  ],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  // The `@mastra/agent-builder` package has `typescript` as a peer dependency and we don't want to bundle it
  external: ['typescript'],
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
