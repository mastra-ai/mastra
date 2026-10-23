import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: [
    'src/storage/index.ts',
    'src/base/index.ts',
    'src/error/index.ts',
    'src/logger/index.ts',
    'src/types/index.ts',
    'src/request-context/index.ts',
    'src/routes/index.ts',
    'src/durable/index.ts',
    'src/knowledge-compat/index.ts',
    'src/memory/index.ts',
    'src/frontmatter/index.ts',
  ],
  dts: true,
});
