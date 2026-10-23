import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts', 'src/worker-entry.ts', 'src/plugin-entry.ts', 'src/client-entry.ts'],
});
