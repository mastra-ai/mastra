import { defineConfig } from 'vitest/config';
export default defineConfig({
  define: { __MASTRA_VERSION__: JSON.stringify('baseline-scratch') },
  test: {
    name: 'network-baseline-scratch',
    environment: 'node',
    include: ['.artifacts/proofs/29487-network/network-proof.test.ts'],
    setupFiles: ['./packages/_test-utils/src/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
