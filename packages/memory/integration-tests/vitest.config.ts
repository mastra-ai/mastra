// import { llmRecorderPlugin } from '@internal/llm-recorder/vite-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Cast to any to avoid vite version mismatch type errors between workspace packages
  plugins: [
    // llmRecorderPlugin({
    //   transformRequest: {
    //     importPath: './src/transform-request',
    //     exportName: 'transformRequest',
    //   },
    // }) as any,
  ],
  test: {
    //pool: 'forks',
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
    globalSetup: './setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
