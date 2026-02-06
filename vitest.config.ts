import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/*',
      '!packages/_config',
      '!packages/_types-builder',
      '!packages/_vendored',
      '!packages/create-mastra',
      '!packages/fastembed',
      '!packages/playground',
      '!packages/playground-ui',
      'stores/*',
      'deployers/*',
      'voice/*',
      'server-adapters/*',
      '!server-adapters/_test-utils',
      'client-sdks/*',
      'auth/*',
      'observability/*',
      '!observability/_examples',
      'pubsub/*',
      'workflows/*',
      '!workflows/README.md',
    ],
  },
});
