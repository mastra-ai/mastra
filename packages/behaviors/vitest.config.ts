import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { name: 'unit:behaviors', environment: 'node', include: ['src/**/*.test.ts'] } });
