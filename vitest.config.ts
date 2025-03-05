import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    workspace: [
      'packages/*',
      'vector-stores/*',
      'deployers/*',
      'speech/*',
      '!vector-stores/docker-compose.yaml',
      '!vector-stores/**/*.md',
    ],
  },
});
