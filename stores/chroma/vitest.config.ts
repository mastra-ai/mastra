import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:stores/chroma',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
