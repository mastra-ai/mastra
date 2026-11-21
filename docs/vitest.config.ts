import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      '@site': fileURLToPath(new URL('.', import.meta.url)),
      '@docusaurus/useGlobalData': fileURLToPath(
        new URL('./node_modules/@docusaurus/core/lib/client/exports/useGlobalData.js', import.meta.url),
      ),
      '@docusaurus/useDocusaurusContext': fileURLToPath(
        new URL('./node_modules/@docusaurus/core/lib/client/exports/useDocusaurusContext.js', import.meta.url),
      ),
    },
  },
  test: {
    name: 'unit:docs',
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
