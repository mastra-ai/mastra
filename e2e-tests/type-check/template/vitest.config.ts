import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'typecheck',
          environment: 'node',
          include: [],
          typecheck: {
            enabled: true,
            include: ['./**/*.test-d.ts'],
            exclude: ['**/node_modules/**', './core/auth.test-d.ts', './core/agent-message-input.test-d.ts'],
          },
        },
      },
      {
        // Auth boundary tests run under exactOptionalPropertyTypes, the
        // strict flag that surfaced #18682 in userland projects.
        test: {
          name: 'typecheck:exact-optional',
          environment: 'node',
          include: [],
          typecheck: {
            enabled: true,
            include: ['./core/auth.test-d.ts', './core/agent-message-input.test-d.ts'],
            exclude: ['**/node_modules/**'],
            tsconfig: './tsconfig.exact-optional.json',
          },
        },
      },
    ],
  },
});
