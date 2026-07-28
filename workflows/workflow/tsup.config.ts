import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/workflows/index.ts'],
  format: ['esm'],
  clean: true,
  dts: false,
  // Each entry must be a single self-contained file. `src/workflows/index.ts`
  // is what the consumer's Workflow SDK compiler processes, and it derives
  // workflow/step IDs from the module specifier of the file it sees. Splitting
  // would move the directive-bearing functions into shared chunks that no
  // `exports` subpath points at, so the IDs would fall back to raw file paths
  // and stop being stable across installs.
  splitting: false,
  // Treeshaking rewrites function bodies, which can drop the `"use workflow"` /
  // `"use step"` directive prologues the Workflow SDK compiler looks for.
  treeshake: false,
  sourcemap: true,
  // Resolved from the consumer's project so the sandbox and host runtimes agree.
  external: ['workflow', 'workflow/api', '@mastra/core'],
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
