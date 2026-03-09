import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:voice/cloudflare',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
