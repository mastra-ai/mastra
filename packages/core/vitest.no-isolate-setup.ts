// Setup for the core unit project that runs without isolation (see vitest.config.ts).
// Files share one worker process, so module-level durable-run state outlives the file
// that created it. setup.ts restarts the deterministic UUID counter for every test, so
// a later file reuses the same run ids and collides with entries an earlier file left
// behind ("live run belongs to agent ...", a thread run whose lease another file's
// run lost). Put that state back to what a fresh worker has after each file.
// Imported lazily so loading these modules never changes what a test file sees while
// it runs.
import { afterAll, beforeAll, beforeEach } from 'vitest';

// Resetting that state is not enough for objects that outlive their file (the
// agentThreadStreamRuntime singleton's process id, a run on a test's own pubsub): a later
// file draws the same ids again and takes the other process's messages for its own. Give
// each file in this worker its own range of ids; the first file keeps the ids it gets in a
// fresh worker. setup.ts's beforeEach runs first and hands the test a fresh counter, which
// this moves to the start of the file's range.
const uuidState = globalThis as { __mastraTestUuidStore?: { getStore(): { counter: number } | undefined } };
const files = globalThis as { __mastraNoIsolateFileIndex?: number };
let fileIndex = 0;

beforeAll(() => {
  fileIndex = files.__mastraNoIsolateFileIndex = (files.__mastraNoIsolateFileIndex ?? -1) + 1;
});

beforeEach(() => {
  const store = uuidState.__mastraTestUuidStore?.getStore();
  if (store) store.counter = fileIndex * 2 ** 32;
});

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
