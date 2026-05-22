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
  onSuccess: async () => {
    await generateTypes(
      process.cwd(),
      new Set([
        'ai',
        '@ai-sdk/provider-utils',
        '@ai-sdk/ui-utils',
        '@standard-schema/spec',
        'eventsource-parser',
        'json-schema',
        '@opentelemetry/api',
      ]),
    );
  },
});
