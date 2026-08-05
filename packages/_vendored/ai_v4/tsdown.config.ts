import { defineConfig } from 'tsdown';
import { sharedConfig } from './tsdown.shared.ts';

// `src/test.ts` is intentionally built separately by tsdown.test.config.ts.
// It pulls in Node-only dependencies whose CommonJS interop was previously hoisted
// into a chunk loaded by @mastra/core's browser-consumable agent/message-list entry.
// The main build owns cleanup, the test build appends its isolated output, and
// scripts/finalize-build.ts generates declarations only after both succeed.
// Regression test: client-sdks/ai-sdk/src/__tests__/browser-bundle.test.ts
export default defineConfig({
  ...sharedConfig,
  entry: ['src/index.ts', 'src/mcp-stdio.ts'],
  clean: true,
});
