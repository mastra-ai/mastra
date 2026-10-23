import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts'],
  // Decorator transforms (experimentalDecorators, emitDecoratorMetadata) come from tsconfig.json.
  tsconfig: 'tsconfig.json',
  bundledTypes: ['rxjs'],
});
