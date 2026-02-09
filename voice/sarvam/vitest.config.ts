import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:voice/sarvam',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
