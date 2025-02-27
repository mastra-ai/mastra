import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    workspace: ['packages/*', 'deployers/*', 'voice/*', 'client-sdks', 'stores/*', 'e2e-tests/*'],
  },
});
