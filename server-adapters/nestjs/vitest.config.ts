import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Test files sit outside tsconfig's include, so vite won't pick up
  // experimentalDecorators for them; NestJS needs legacy decorators + metadata.
  oxc: {
    decorator: { legacy: true, emitDecoratorMetadata: true },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
