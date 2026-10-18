import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Load environment variables
config();

export default defineConfig({
  test: {
    name: 'e2e:stores/azure-ai-search',
    environment: 'node',
    globals: true,
    // Index create/delete on the Free SKU regularly takes >10s; the conformance
    // suite creates a fresh index per test in several describe blocks.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
