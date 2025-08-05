import { defineConfig } from 'tsup';
import { generateTypes } from '@internal/types-builder';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/analytics/index.ts',
    'src/commands/create/create.ts',
    'src/commands/dev/telemetry-loader.ts',
    'src/commands/dev/telemetry-resolver.ts',
  ],
  treeshake: true,
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
