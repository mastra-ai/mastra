import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    workspace: ['packages/*', 'vector-stores/*', 'deployers/*', '!vector-stores/docker-compose.yaml'],
  },
});
