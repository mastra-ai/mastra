import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:stores/dynamodb',
    globals: true,
    environment: 'node',
  },
});
