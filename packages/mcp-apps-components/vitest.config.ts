import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

export default defineConfig({
  test: {
    projects: [
      {
        // Set on the project itself: the repo's root vitest config runs it without this file's top level.
        plugins: [react()],
        define: { __PACKAGE_VERSION__: JSON.stringify(version) },
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
