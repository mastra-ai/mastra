import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts', 'src/kv/index.ts', 'src/do/index.ts'],
});
