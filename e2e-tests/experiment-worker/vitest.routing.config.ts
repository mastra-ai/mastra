import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'helpers/command.test.ts',
      'helpers/copy-artifact.test.ts',
      'tests/assertion-evidence-drift.test.ts',
      'tests/workflow-routing.test.ts',
      'tests/materialize-project.test.ts',
      'tests/inspect-manifest.test.ts',
      'tests/registry-digest.test.ts',
      'tests/scenario-reporter.test.ts',
      'tests/verdaccio-resolution.test.ts',
      'vitest.config.test.ts',
    ],
  },
});
