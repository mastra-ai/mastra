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
