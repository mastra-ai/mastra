import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:voice/openai-realtime-api',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
