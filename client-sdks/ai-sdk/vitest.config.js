import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:client-sdks/ai-sdk',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
