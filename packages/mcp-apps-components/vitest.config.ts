import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit:packages/mcp-apps-components',
          // Browser-side tests opt into jsdom with a `@vitest-environment jsdom` comment.
          environment: 'node',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.ts'],
          // Must stay above the 3s Testing Library async timeout set in setup.ts.
          testTimeout: 15000,
        },
      },
    ],
  },
});
