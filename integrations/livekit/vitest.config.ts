import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:integrations/livekit',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
