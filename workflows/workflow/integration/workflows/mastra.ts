/**
 * Stand-in for the file a consumer writes in their own `workflows/` directory.
 *
 * Two jobs, both required:
 *  - re-export the package's workflow entry so the Workflow SDK compiler assigns the
 *    runner and its steps ids that are stable across builds;
 *  - import the Mastra definitions for their side effects so the registry is
 *    populated in the process that executes steps.
 *
 * A published consumer writes `export * from '@mastra/workflow/workflows'`,
 * which resolves to the built `dist/workflows/index.js`. In-repo the fixture
 * points at source and names the two directive-bearing modules directly:
 * Workflow SDK's discovery pass resolves relative specifiers itself and does not
 * apply TypeScript's `.js` -> `.ts` rewrite, so it cannot see through the
 * barrel file the way a bundler can.
 */
import '../defs';

export * from '../../src/workflows/runner';
export * from '../../src/workflows/steps';
