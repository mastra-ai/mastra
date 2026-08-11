import { defineConfig } from 'tsdown';
import { sharedConfig } from './tsdown.shared.ts';

// Keep the Node-only test entry in a separate build so its createRequire interop
// cannot be hoisted into chunks shared with browser-consumable code. The separate
// builds intentionally duplicate modules reached by both entry graphs when consumers
// import both main and test; preserving the browser-safe boundary is worth that cost.
export default defineConfig({
  ...sharedConfig,
  entry: ['src/test.ts'],
  clean: false,
});
