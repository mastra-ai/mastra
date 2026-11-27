import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:browser/browser-viewer',
    globals: true,
    environment: 'node',
  },
});
