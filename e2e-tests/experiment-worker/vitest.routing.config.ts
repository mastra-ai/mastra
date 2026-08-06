import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/workflow-routing.test.ts',
      'tests/materialize-project.test.ts',
      'tests/registry-digest.test.ts',
      'tests/scenario-reporter.test.ts',
      'tests/verdaccio-resolution.test.ts',
    ],
  },
});
