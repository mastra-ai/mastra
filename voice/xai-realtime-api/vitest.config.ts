import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'voice/xai-realtime-api',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
