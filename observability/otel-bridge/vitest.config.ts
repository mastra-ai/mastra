import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

// Note: You may see "punycode module is deprecated" warnings during tests.
// This is a known issue from OpenTelemetry dependencies (uri-js, whatwg-url)
// and will be fixed upstream. It does not affect functionality.

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'unit:observability/otel-bridge',
      isolate: false,
      globals: true,
      environment: 'node',
      env: {
        NODE_ENV: 'test',
      },
    },
  }),
);
