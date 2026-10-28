import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['monorepo.test.ts', 'bun-workspace.test.ts', 'npm-workspace.test.ts', 'root-workspace.test.ts'],
    globalSetup: './setup.ts',
  },
});
