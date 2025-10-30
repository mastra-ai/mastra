import { MockStore } from '@mastra/core/storage';
import { createTestSuite } from './factory';

createTestSuite(new MockStore());
