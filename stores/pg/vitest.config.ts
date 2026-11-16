import { defineConfig } from 'vitest/config';

const exclude = ['src/**/*.performance.test.ts', 'src/**/performance-indexes/*.test.ts', 'src/**/*.pooler.test.ts'];

// Delta polling's horizon is pg_snapshot_xmin(pg_current_snapshot())
// (src/storage/domains/observability/v-next/polling.ts), which is cluster-wide:
// an open transaction in any database on the server holds it back. Per-worker
// databases can't isolate these files, so they run alone after the parallel group.
const clusterWideFiles = ['src/storage/domains/observability/v-next/integration.test.ts'];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'e2e:stores/pg',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: [...exclude, ...clusterWideFiles],
          // Each worker gets its own database (see vitest.global-setup.ts), so files
          // don't share tables. Pinned rather than auto: measured at 4, and the
          // shared test server's max_connections is 100.
          maxWorkers: 4,
          globalSetup: ['./vitest.global-setup.ts'],
          setupFiles: ['./vitest.setup.ts'],
          sequence: { groupOrder: 0 },
        },
      },
      {
        test: {
          name: 'e2e:stores/pg-sequential',
          environment: 'node',
          include: clusterWideFiles,
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
