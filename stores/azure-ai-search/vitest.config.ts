import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Load environment variables
config();

export default defineConfig({
  test: {
    name: 'e2e:stores/azure-ai-search',
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
