import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:browser/agent-browser',
    globals: true,
    environment: 'node',
  },
});
