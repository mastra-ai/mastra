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
    isolate: false,
    coverage: {
      provider: 'v8', // or 'istanbul'
    },
  },
});
