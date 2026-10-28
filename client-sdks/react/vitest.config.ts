import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    name: 'unit:client-sdks/react',
    isolate: true,
    setupFiles: ['./src/test/vitest-setup.ts'],
    testTimeout: 15000,
    env: { TZ: 'UTC' },
    coverage: {
      provider: 'v8', // or 'istanbul'
    },
  },
});
