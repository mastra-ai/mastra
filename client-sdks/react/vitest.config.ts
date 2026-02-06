import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit',
    coverage: {
      provider: 'v8', // or 'istanbul'
    },
  },
});
