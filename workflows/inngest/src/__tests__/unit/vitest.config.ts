import { defineConfig } from 'vitest/config';

// Separate from the dev-server suites: changed-test CI can run these directly
// with the base implementation and no Inngest CLI or external services.
export default defineConfig({
  test: {
    name: 'unit:workflows/inngest',
    root: import.meta.dirname,
    include: ['*.test.ts'],
    env: { INNGEST_DEV: '1' },
  },
});
