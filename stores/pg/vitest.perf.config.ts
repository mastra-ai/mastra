import { defineConfig } from 'vitest/config';

const includePgPerfIntegration = process.env.MASTRA_RUN_PG_PERF_INTEGRATION === 'true';
const includePgVectorPerf = process.env.MASTRA_RUN_PG_VECTOR_PERF === 'true';

const include = [
  'src/**/performance-indexes/*.test.ts',
  'src/storage/domains/memory/row-number-performance.test.ts',
];
if (includePgVectorPerf) {
  include.push('src/vector/vector.performance.test.ts');
}

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include,
    exclude: includePgPerfIntegration ? [] : ['src/**/performance-indexes/*.integration.test.ts'],
  },
});
