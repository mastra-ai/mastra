import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:voice/google-gemini-live-api',
    globals: true,
    environment: 'node',
  },
});
