import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [], // This package is a library - tests run from engine packages
  },
});
