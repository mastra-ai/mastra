import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/server/handlers.ts',
    'src/server/handlers/*.ts',
    'src/server/a2a/store.ts',
    'src/server/server-adapter/index.ts',
    'src/server/auth/index.ts',
    'src/server/schemas/index.ts',
    'src/server/browser-stream/index.ts',
    '!src/server/handlers/*.test.ts',
    '!src/server/auth/*.test.ts',
    '!src/server/schemas/*.test.ts',
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
    await generateTypes(process.cwd(), new Set(['@internal/core']));
  },
});
