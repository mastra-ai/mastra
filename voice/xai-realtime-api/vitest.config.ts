import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'voice/xai-realtime-api',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
