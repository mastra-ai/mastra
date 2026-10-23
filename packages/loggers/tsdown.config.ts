import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts', 'src/file/index.ts', 'src/upstash/index.ts', 'src/http/index.ts'],
});
