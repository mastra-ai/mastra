import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:voice/openai',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
