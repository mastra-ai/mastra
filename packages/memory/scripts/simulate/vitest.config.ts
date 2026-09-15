import { defineConfig } from 'vitest/config';

// The simulator lives outside the package's `src/**/*.test.ts` discovery root, so
// it owns its own Vitest config the way `integration-tests/` does. This keeps the
// suites colocated with the modules they cover without widening the package
// include, and lets the Changed Test Gate resolve them against this config.
export default defineConfig({
  test: {
    name: 'unit:packages/memory/scripts/simulate',
    environment: 'node',
    include: ['*.test.ts'],
    isolate: false,
    reporters: 'dot',
    bail: 1,
  },
});
