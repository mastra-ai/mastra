import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/workflow-routing.test.ts', 'tests/materialize-project.test.ts'],
  },
});
