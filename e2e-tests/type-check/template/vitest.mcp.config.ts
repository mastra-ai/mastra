import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'typecheck:mcp',
    environment: 'node',
    include: [],
    typecheck: {
      enabled: true,
      include: ['./mcp/**/*.test-d.ts'],
      exclude: ['**/node_modules/**'],
      tsconfig: './tsconfig.mcp.json',
    },
  },
});
