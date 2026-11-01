// Setup for the core unit project that runs without isolation (see vitest.config.ts).
// Files share one worker process, so module-level durable-run state outlives the file
// that created it. setup.ts restarts the deterministic UUID counter for every test, so
// a later file reuses the same run ids and collides with entries an earlier file left
// behind ("live run belongs to agent ...", a thread run whose lease another file's
// run lost). Put that state back to what a fresh worker has after each file.
// Imported lazily so loading these modules never changes what a test file sees while
// it runs.
import { afterAll } from 'vitest';

afterAll(async () => {
  const [fences, registry, threadRuntime, leaseFences] = await Promise.all([
    import('./src/agent/durable/execution-fence'),
    import('./src/agent/durable/run-registry'),
    import('./src/agent/thread-stream-runtime'),
    import('./src/agent/run-lease-fence'),
  ]);
  registry.globalRunRegistry.clear();
  registry.__resetRunRegistryActivityForTests();
  fences.__resetExecutionFencesForTests();
  threadRuntime.agentThreadStreamRuntime.resetForTests();
  // Lease checks registered through a test's own pubsub, which resetForTests doesn't reach.
  leaseFences.__resetRunLeaseFencesForTests();
});
