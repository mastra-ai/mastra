import { InMemoryStore } from '@mastra/core/storage';

import { testPersistenceProjection } from './persistence-projection.test-utils';

testPersistenceProjection(async () => new InMemoryStore());
