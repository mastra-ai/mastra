import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'unit:docs',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
