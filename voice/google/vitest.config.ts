import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:voice/google',
    globals: true,
    environment: 'node',
  },
});
