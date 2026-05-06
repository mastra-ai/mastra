import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:browser/agent-browser',
    globals: true,
    environment: 'node',
  },
});
