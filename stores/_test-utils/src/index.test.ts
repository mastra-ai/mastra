import { InMemoryStore } from '@mastra/core/storage';
import { createTestSuite } from './factory';

createTestSuite(new InMemoryStore());
