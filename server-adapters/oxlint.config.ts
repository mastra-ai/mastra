import { defineConfig } from 'oxlint';
import rootConfig from '../oxlint.config.ts';

export default defineConfig({
  extends: [rootConfig],
  ignorePatterns: [
    'express/**/vitest.perf.config.ts',
    'express/**/performance-test.ts',
    'fastify/**/vitest.perf.config.ts',
    'fastify/**/performance-test.ts',
    'hono/**/vitest.perf.config.ts',
    'hono/**/performance-test.ts',
    'koa/**/vitest.perf.config.ts',
    'koa/**/performance-test.ts',
  ],
});
