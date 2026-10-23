import { defineLibConfig } from '@internal/types-builder/tsdown';

export default defineLibConfig({
  entry: ['src/index.ts', 'src/setup.ts'],
  dts: true,
  // vitest must be external so hooks use the consumer's test runner instance
  deps: {
    neverBundle: [/^@internal\/ai-sdk-v5/, 'lightningcss', 'postcss', 'vite', 'vitest'],
    alwaysBundle: ['@internal/llm-recorder'],
  },
});
