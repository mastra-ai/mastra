import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:integrations/livekit',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
