import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:voice/google-gemini-live-api',
    globals: true,
    environment: 'node',
  },
});
