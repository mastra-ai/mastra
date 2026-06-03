import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/openai',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
