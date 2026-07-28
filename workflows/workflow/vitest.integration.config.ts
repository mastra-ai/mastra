import { fileURLToPath } from 'node:url';
import { workflow } from '@workflow/vitest';
import { defineConfig } from 'vitest/config';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    workflow({
      // Point the Workflow SDK builder at the fixture app rather than the package
      // root. It globs every source file under `cwd`, and the package root
      // holds `src/` and a built `dist/` that also carry directives — scanning
      // those would register the same functions under several ids.
      cwd: fileURLToPath(new URL('./integration', import.meta.url)),
    }),
  ],
  test: {
    root: packageRoot,
    include: ['integration/**/*.test.ts'],
    // Cold start builds the workflow bundles; individual runs are quick.
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
