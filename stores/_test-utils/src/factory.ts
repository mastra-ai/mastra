import { describe, beforeAll, afterAll } from 'vitest';
import type { MastraStorage } from '@mastra/core/storage';
import { createScoresTest } from './domains/scores';
import { createMemoryTest } from './domains/memory';
import { createWorkflowsTests } from './domains/workflows';
import { createObservabilityTests } from './domains/observability';
import { createAgentsTests } from './domains/agents';
export * from './domains/memory/data';
export * from './domains/workflows/data';
export * from './domains/scores/data';
export * from './domains/observability/data';
export * from './domains/agents/data';

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
      const clearList: Promise<void>[] = [];

      const workflowStorage = await storage.getStore('workflows');
      const memoryStorage = await storage.getStore('memory');
      const scoresStorage = await storage.getStore('scores');
      const observabilityStorage = await storage.getStore('observability');
      const agentsStorage = await storage.getStore('agents');

      if (workflowStorage) {
        clearList.push(workflowStorage.dangerouslyClearAll());
      }
      if (memoryStorage) {
        clearList.push(memoryStorage.dangerouslyClearAll());
      }
      if (scoresStorage) {
        clearList.push(scoresStorage.dangerouslyClearAll());
      }
      if (observabilityStorage) {
        clearList.push(observabilityStorage.dangerouslyClearAll());
      }
      if (agentsStorage && storage.supports.agents) {
        clearList.push(agentsStorage.dangerouslyClearAll());
      }
      // Clear all domain data after tests
      await Promise.all(clearList);
    });

    // Tests are registered unconditionally - each test internally handles
    // checking if the storage domain is available
    createWorkflowsTests({ storage });
    createMemoryTest({ storage });
    createScoresTest({ storage });
    if (storage.supports.observability) {
      createObservabilityTests({ storage });
    }
    createAgentsTests({ storage });
  });
}
