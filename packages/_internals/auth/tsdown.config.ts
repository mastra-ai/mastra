import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: [
    'src/index.ts',
    'src/provider/index.ts',
    'src/types/index.ts',
    'src/session/index.ts',
    'src/ee/index.ts',
    'src/ee/capabilities.ts',
  ],
  bundledTypes: ['@internal/core'],
});
