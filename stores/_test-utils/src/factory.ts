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
      // Clear all domain data after tests
      await Promise.all([
        storage.stores.workflows.dangerouslyClearAll(),
        storage.stores.memory.dangerouslyClearAll(),
        storage.stores.scores.dangerouslyClearAll(),
        storage.supports.observabilityInstance && storage.stores.observability.dangerouslyClearAll(),
        storage.supports.agents && storage.stores.agents.dangerouslyClearAll(),
      ]);
    });

    createWorkflowsTests({ storage });

    createMemoryTest({ storage });

    createScoresTest({ storage });

    if (storage.supports.observabilityInstance) {
      createObservabilityTests({ storage });
    }

    // Agents tests are conditionally run based on storage.supports.agents inside the test suite
    createAgentsTests({ storage });
  });
}
