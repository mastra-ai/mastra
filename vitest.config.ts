import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'vector-stores/*', 'deployers/*', 'speech/*'],
  },
});
