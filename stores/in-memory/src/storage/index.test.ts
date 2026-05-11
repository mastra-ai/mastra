import { createObservabilityTests } from '../../../_test-utils/src';
import { InMemoryStore } from '../index';

createObservabilityTests({ storage: new InMemoryStore({ id: 'in-memory-observability-test-store' }) });
