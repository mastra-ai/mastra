import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:browser/browser-viewer',
    globals: true,
    environment: 'node',
  },
});
