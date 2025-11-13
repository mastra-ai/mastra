import { resolve } from 'path';
import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Load environment variables from .env for tests
config({ path: resolve(__dirname, '.env') });

// Note: You may see "punycode module is deprecated" warnings during tests.
// This is a known issue from OpenTelemetry dependencies (uri-js, whatwg-url)
// and will be fixed upstream. It does not affect functionality.

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
    },
  },
});
