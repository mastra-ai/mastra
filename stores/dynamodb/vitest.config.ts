import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:stores/dynamodb',
    globals: true,
    environment: 'node',
  },
});
