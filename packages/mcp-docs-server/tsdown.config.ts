import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts', 'src/stdio.ts'],
  format: ['esm'],
});
