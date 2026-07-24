import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:stores/chroma',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
