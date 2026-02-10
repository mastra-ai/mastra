import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/_changeset-cli',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
