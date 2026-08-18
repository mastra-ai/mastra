import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:voice/cloudflare',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
