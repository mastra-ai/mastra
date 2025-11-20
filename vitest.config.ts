import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/*',
      'vector-stores/*',
      'deployers/*',
      'speech/*',
      '!vector-stores/docker-compose.yaml',
      '!vector-stores/**/*.md',
    ],
  },
});
