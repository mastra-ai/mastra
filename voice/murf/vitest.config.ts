import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:voice/murf',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
