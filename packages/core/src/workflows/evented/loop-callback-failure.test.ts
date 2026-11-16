import { MockStore } from '../../storage/mock';
import { describeLoopCallbackFailures } from './test-utils/loop-callback-failure-cases';

// Postgres runs the same cases in stores/pg (step-guarded condition path).
// A fresh store per test: the test setup restarts randomUUID per test, so run IDs repeat.
describeLoopCallbackFailures({ getStorage: () => new MockStore() });
