import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  // Externalize optional dependencies so dynamic imports work at runtime
  external: ['http-proxy', 'selfsigned'],
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
