import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/studio-agent-builder',
    isolate: false,
    environment: 'node',
    include: ['ee/src/**/*.test.ts'],
  },
});
