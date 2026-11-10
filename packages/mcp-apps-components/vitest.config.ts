import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

export default defineConfig({
  plugins: [react()],
  define: { __PACKAGE_VERSION__: JSON.stringify(version) },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit:packages/mcp-apps-components',
          // Browser-side tests opt into jsdom with a `@vitest-environment jsdom` comment.
          environment: 'node',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/__tests__/setup.ts'],
          testTimeout: 15000,
        },
      },
      {
        test: {
          name: 'typecheck:packages/mcp-apps-components',
          environment: 'node',
          include: [],
          typecheck: {
            enabled: true,
            include: ['src/**/*.test-d.ts'],
          },
        },
      },
    ],
  },
});
