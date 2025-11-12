import { describe, beforeAll, afterAll } from 'vitest';
import type { MastraStorage } from '@mastra/core/storage';
import { createScoresTest } from './domains/scores';
import { createMemoryTest } from './domains/memory';
import { createWorkflowsTests } from './domains/workflows';
import { createObservabilityTests } from './domains/observability';
import { createIndexManagementTests } from './domains/operations/index-management';

export * from './domains/memory/data';
export * from './domains/workflows/data';
export * from './domains/scores/data';
export * from './domains/observability/data';


export function createTestSuite(storage: MastraStorage) {
  describe(storage.constructor.name, () => {
    beforeAll(async () => {
      const start = Date.now();
      console.log('Initializing storage...');
      await storage.init();
      const end = Date.now();
      console.log(`Storage initialized in ${end - start}ms`);
    });

    afterAll(async () => {
      // Clear tables after tests
      await Promise.all([
        storage.getStore('workflows')?.dropData(),
        storage.getStore('evals')?.dropData(),
        storage.getStore('memory')?.dropData(),
        storage.supports.observabilityInstance && storage.getStore('observability')?.dropData(),
      ]);
    });

    createWorkflowsTests({ storage });

    createMemoryTest({ storage });

    createScoresTest({ storage });

    if (storage.supports.observabilityInstance) {
      createObservabilityTests({ storage });
    }

    createIndexManagementTests({ storage });
  });
}
