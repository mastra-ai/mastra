import { defineConfig } from 'tsdown';
import { sharedConfig } from './tsdown.shared.ts';

// Keep the Node-only test entry in a separate build so its createRequire interop
// cannot be hoisted into chunks shared with browser-consumable code.
export default defineConfig({
  ...sharedConfig,
  entry: ['src/test.ts'],
  clean: false,
});
