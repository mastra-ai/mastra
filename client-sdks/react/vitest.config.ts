import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:client-sdks/react',
    isolate: false,
    coverage: {
      provider: 'v8', // or 'istanbul'
    },
  },
});
