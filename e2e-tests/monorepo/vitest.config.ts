import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['monorepo.test.ts', 'bun-workspace.test.ts'],
    globalSetup: './setup.ts',
  },
});
