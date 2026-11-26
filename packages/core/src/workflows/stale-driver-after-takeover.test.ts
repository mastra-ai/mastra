import { InMemoryStore } from '../storage/mock';
import { describeStaleDriverCases } from './test-utils/stale-driver-cases';

// A process that stalls past its run lease must not overwrite a run another process took over.
describeStaleDriverCases({ getStorage: () => new InMemoryStore() });
