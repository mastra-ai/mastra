import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:voice/deepgram',
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
