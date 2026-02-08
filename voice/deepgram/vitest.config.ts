import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:voice/deepgram',
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
